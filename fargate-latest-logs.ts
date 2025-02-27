#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env

/**
 * Fargate Latest N Logs Fetcher
 * 
 * This script fetches the latest N logs from all tasks and containers in a Fargate service,
 * with color-coded prefixes for easy identification.
 */

// Colors for terminal output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
  };
  
  // Configuration
  const config = {
    clusterName: Deno.env.get("CLUSTER_NAME") || "your-cluster-name",
    serviceName: Deno.env.get("SERVICE_NAME") || "your-service-name",
    region: Deno.env.get("AWS_REGION") || "us-east-1",
    logCount: parseInt(Deno.env.get("LOG_COUNT") || "100"), // Number of logs to fetch
    timeRangeHours: parseInt(Deno.env.get("TIME_RANGE_HOURS") || "24"), // Hours to look back for logs
    sortByTime: Deno.env.get("SORT_BY_TIME") === "true", // Whether to sort all logs by timestamp
  };
  
  // Interfaces for AWS response types
  interface Task {
    taskArn: string;
    taskDefinitionArn: string;
    containers: Container[];
  }
  
  interface Container {
    name: string;
    containerArn: string;
  }
  
  interface TaskDefinition {
    containerDefinitions: {
      name: string;
      logConfiguration?: {
        logDriver: string;
        options: {
          "awslogs-group": string;
          "awslogs-region": string;
          "awslogs-stream-prefix"?: string;
        };
      };
    }[];
  }
  
  interface LogStream {
    logStreamName: string;
  }
  
  interface LogEvent {
    timestamp: number;
    message: string;
    ingestionTime?: number;
  }
  
  interface ContainerLogConfig {
    taskId: string;
    containerName: string;
    logGroup: string;
    logStream: string;
    color: string;
  }
  
  // Execute AWS CLI command and return JSON result
  async function awsCommand(
    service: string,
    command: string,
    args: Record<string, string | string[]>,
    flags: string[] = [],
  ): Promise<any> {
    const cmdArgs = ["aws", service, command, "--region", config.region];
    
    for (const [key, value] of Object.entries(args)) {
      cmdArgs.push(`--${key}`);
      if (Array.isArray(value)) {
        cmdArgs.push(...value);
      } else {
        cmdArgs.push(value);
      }
    }
    
    // Add boolean flags (without values)
    for (const flag of flags) {
      cmdArgs.push(`--${flag}`);
    }
  
    const process = Deno.run({
      cmd: cmdArgs,
      stdout: "piped",
      stderr: "piped",
    });
  
    const [status, stdout, stderr] = await Promise.all([
      process.status(),
      process.output(),
      process.stderrOutput(),
    ]);
    process.close();
  
    if (!status.success) {
      const errorMessage = new TextDecoder().decode(stderr);
      throw new Error(`AWS CLI error: ${errorMessage}`);
    }
  
    const output = new TextDecoder().decode(stdout);
    return JSON.parse(output);
  }
  
  // Get all running tasks for the service
  async function getTasks(): Promise<Task[]> {
    console.log(`Fetching tasks for service ${config.serviceName} in cluster ${config.clusterName}...`);
    
    const response = await awsCommand("ecs", "list-tasks", {
      "cluster": config.clusterName,
      "service-name": config.serviceName,
    });
  
    if (!response.taskArns || response.taskArns.length === 0) {
      throw new Error(`No running tasks found for service ${config.serviceName}`);
    }
  
    const tasksResponse = await awsCommand("ecs", "describe-tasks", {
      "cluster": config.clusterName,
      "tasks": response.taskArns,
    });
  
    return tasksResponse.tasks;
  }
  
  // Get task definition for a task
  async function getTaskDefinition(taskDefinitionArn: string): Promise<TaskDefinition> {
    const response = await awsCommand("ecs", "describe-task-definition", {
      "task-definition": taskDefinitionArn,
    });
    return response.taskDefinition;
  }
  
  // Get log stream for a container
  async function getLogStream(
    logGroup: string,
    streamPrefix: string,
  ): Promise<LogStream | null> {
    try {
      const response = await awsCommand("logs", "describe-log-streams", {
        "log-group-name": logGroup,
        "log-stream-name-prefix": streamPrefix,
        "order-by": "LogStreamName",
        "limit": "1",
      });
  
      if (response.logStreams && response.logStreams.length > 0) {
        return response.logStreams[0];
      }
    } catch (error) {
      console.error(`Error finding log stream for ${streamPrefix}: ${error.message}`);
    }
    return null;
  }
  
  // Get log events from a log stream
  async function getLogEvents(
    logGroup: string,
    logStream: string,
    limit: number,
    startTime?: number,
    endTime?: number,
  ): Promise<LogEvent[]> {
    const args: Record<string, string | string[]> = {
      "log-group-name": logGroup,
      "log-stream-name": logStream,
      "limit": limit.toString(),
    };
  
    if (startTime) {
      args["start-time"] = startTime.toString();
    }
  
    if (endTime) {
      args["end-time"] = endTime.toString();
    }
  
    try {
      const response = await awsCommand("logs", "get-log-events", args);
      return response.events || [];
    } catch (error) {
      console.error(`Error getting log events for ${logStream}: ${error.message}`);
      return [];
    }
  }
  
  // Extract task ID from task ARN
  function getTaskId(taskArn: string): string {
    const parts = taskArn.split("/");
    return parts[parts.length - 1];
  }
  
  // Format timestamp to human-readable date
  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString();
  }
  
  // Setup all container log configurations
  async function setupContainerLogs(): Promise<ContainerLogConfig[]> {
    const containerLogs: ContainerLogConfig[] = [];
    const colorList = Object.values(colors).filter(c => c !== colors.reset);
    
    // Get all tasks
    const tasks = await getTasks();
    console.log(`Found ${tasks.length} tasks running`);
  
    let colorIndex = 0;
    
    for (const task of tasks) {
      const taskId = getTaskId(task.taskArn);
      const taskDef = await getTaskDefinition(task.taskDefinitionArn);
      
      for (const container of task.containers) {
        // Find container definition
        const containerDef = taskDef.containerDefinitions.find(
          def => def.name === container.name
        );
        
        if (!containerDef || !containerDef.logConfiguration) {
          console.warn(`No log configuration found for container ${container.name}`);
          continue;
        }
        
        const logConfig = containerDef.logConfiguration;
        
        if (logConfig.logDriver !== "awslogs") {
          console.warn(`Container ${container.name} doesn't use awslogs driver`);
          continue;
        }
        
        const logGroup = logConfig.options["awslogs-group"];
        const streamPrefix = logConfig.options["awslogs-stream-prefix"] || containerDef.name;
        const logStreamPrefix = `${streamPrefix}/${containerDef.name}/${taskId}`;
        
        const logStream = await getLogStream(logGroup, logStreamPrefix);
        
        if (!logStream) {
          console.warn(`No log stream found for ${logStreamPrefix}`);
          continue;
        }
        
        containerLogs.push({
          taskId,
          containerName: container.name,
          logGroup,
          logStream: logStream.logStreamName,
          color: colorList[colorIndex % colorList.length],
        });
        
        colorIndex++;
      }
    }
    
    return containerLogs;
  }
  
  // Fetch latest logs for all containers
  async function fetchLatestLogs(containerLogs: ContainerLogConfig[]): Promise<void> {
    const now = Date.now();
    const startTime = now - (config.timeRangeHours * 60 * 60 * 1000);
    const allEvents: (LogEvent & { 
      containerName: string; 
      taskId: string; 
      color: string;
    })[] = [];
    
    console.log(`Fetching logs from the last ${config.timeRangeHours} hours...`);
    
    for (const container of containerLogs) {
      console.log(`Fetching up to ${config.logCount} logs for ${container.containerName} (${container.taskId.slice(0, 8)})...`);
      
      const events = await getLogEvents(
        container.logGroup,
        container.logStream,
        config.logCount,
        startTime,
        now
      );
      
      // Add container information to each event
      events.forEach(event => {
        allEvents.push({
          ...event,
          containerName: container.containerName,
          taskId: container.taskId,
          color: container.color,
        });
      });
    }
    
    if (allEvents.length === 0) {
      console.log("No logs found in the specified time range.");
      return;
    }
    
    // Sort all events by timestamp if requested
    if (config.sortByTime) {
      allEvents.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // Display the logs
    console.log(`\n--- Displaying ${allEvents.length} log entries ---\n`);
    
    for (const event of allEvents) {
      const prefix = `${event.color}[${formatTimestamp(event.timestamp)} ${config.clusterName}.${config.serviceName}.${event.taskId.slice(0, 8)}.${event.containerName}]${colors.reset}`;
      console.log(`${prefix} ${event.message}`);
    }
  }
  
  // Main function
  async function main() {
    try {
      console.log("Fargate Latest Logs Fetcher starting...");
      console.log(`Cluster: ${config.clusterName}, Service: ${config.serviceName}, Region: ${config.region}`);
      console.log(`Fetching latest ${config.logCount} logs per container from the last ${config.timeRangeHours} hours`);
      
      const containerLogs = await setupContainerLogs();
      
      if (containerLogs.length === 0) {
        throw new Error("No container logs found to fetch");
      }
      
      console.log(`Found ${containerLogs.length} containers to fetch logs from`);
      await fetchLatestLogs(containerLogs);
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
      Deno.exit(1);
    }
  }
  
  // Run the main function
  main();