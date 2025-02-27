# Fargate Logs Utilities

A collection of utilities for monitoring and managing logs from AWS Fargate services.

## Overview

This project provides a set of tools to help you work with AWS Fargate logs more efficiently:

1. **Fargate Logs Tailer (`fargate-logs.ts`)** - Continuously tails logs in real-time from all tasks and containers
2. **Fargate Latest Logs Fetcher (`fargate-latest-logs.ts`)** - Fetches the N most recent logs from all tasks and containers
3. **Shell Functions** - Convenient `.zshrc` functions for easy command-line usage

## Features

- **Multi-container support**: Monitor logs across all tasks and containers in a service
- **Color-coded output**: Easily distinguish logs from different sources
- **Consistent prefixing**: Clear identification of log sources with `[cluster.service.task.container]`
- **Real-time and historical modes**: Both continuous tailing and point-in-time fetching
- **Time window filtering**: Limit log fetching to a specific time window
- **Consolidated view**: Option to sort logs from all containers by timestamp
- **Shell integration**: Functions for easy use in daily workflows

## Prerequisites

- [Deno](https://deno.land/#installation) installed on your system
- AWS CLI installed and configured with appropriate permissions
- Permissions to read CloudWatch logs and describe ECS tasks

## Installation and Usage

### Option 1: Running Directly from Git URLs

You can run the scripts directly from this repository:

```bash
# Tail logs in real-time
deno run --allow-net --allow-run --allow-env https://raw.githubusercontent.com/jiraguha/ecs-logs/main/fargate-logs.ts

# Fetch latest logs
deno run --allow-net --allow-run --allow-env https://raw.githubusercontent.com/jiraguha/ecs-logs/main/fargate-latest-logs.ts
```

### Option 2: Clone the Repository

```bash
git clone https://github.com/username/fargate-logs-utils.git
cd fargate-logs-utils
chmod +x fargate-logs.ts fargate-latest-logs.ts

# Tail logs in real-time
CLUSTER_NAME="your-cluster" SERVICE_NAME="your-service" AWS_REGION="your-region" ./fargate-logs.ts

# Fetch latest logs
CLUSTER_NAME="your-cluster" SERVICE_NAME="your-service" AWS_REGION="your-region" LOG_COUNT="100" ./fargate-latest-logs.ts
```

### Option 3: Install Shell Functions

Add the provided shell functions to your `.zshrc` file for convenient usage:

```bash
# In your .zshrc file
source /path/to/fargate-logs-utils/zshrc-functions.sh

# Then use them like this:
fargate_logs eu-west-3 main-backend orteliusdev
fargate_latest_logs eu-west-3 main-backend orteliusdev 100 24 true

# Or use the shorter aliases
ftl eu-west-3 main-backend orteliusdev
fll eu-west-3 main-backend orteliusdev
```

## Configuration

### Fargate Logs Tailer

Environment variables for `fargate-logs.ts`:

| Variable | Description | Default |
|----------|-------------|---------|
| `CLUSTER_NAME` | ECS cluster name | "your-cluster-name" |
| `SERVICE_NAME` | Fargate service name | "your-service-name" |
| `AWS_REGION` | AWS region | "us-east-1" |
| `MAX_HISTORY` | Number of log entries to fetch initially | 100 |

### Fargate Latest Logs Fetcher

Environment variables for `fargate-latest-logs.ts`:

| Variable | Description | Default |
|----------|-------------|---------|
| `CLUSTER_NAME` | ECS cluster name | "your-cluster-name" |
| `SERVICE_NAME` | Fargate service name | "your-service-name" |
| `AWS_REGION` | AWS region | "us-east-1" |
| `LOG_COUNT` | Number of logs to fetch per container | 100 |
| `TIME_RANGE_HOURS` | How many hours to look back for logs | 24 |
| `SORT_BY_TIME` | Whether to sort all logs by timestamp | false |

### Shell Functions

Default environment variables for the shell functions:

```bash
export FARGATE_DEFAULT_REGION="eu-west-3"
export FARGATE_DEFAULT_CLUSTER="main-backend"
export FARGATE_DEFAULT_SERVICE="orteliusdev"
```

## Examples

### Basic Usage

```bash
# Tail logs in real-time
CLUSTER_NAME="main-backend" SERVICE_NAME="orteliusdev" AWS_REGION="eu-west-3" ./fargate-logs.ts

# Fetch 50 latest logs from the past 6 hours, sorted by time
CLUSTER_NAME="main-backend" SERVICE_NAME="orteliusdev" AWS_REGION="eu-west-3" LOG_COUNT="50" TIME_RANGE_HOURS="6" SORT_BY_TIME="true" ./fargate-latest-logs.ts
```

### With Shell Functions

```bash
# Using defaults set in your .zshrc
ftl

# Specifying parameters (region, cluster, service)
ftl eu-west-3 main-backend orteliusdev

# Fetching logs with custom parameters
fll eu-west-3 main-backend orteliusdev 200 48 true
```

## Script Details

### fargate-logs.ts

This script:
1. Identifies all running tasks for the specified service
2. Finds all containers within those tasks
3. Locates the appropriate CloudWatch log streams
4. Sets up continuous polling for new log entries
5. Displays log entries with color-coded prefixes

### fargate-latest-logs.ts

This script:
1. Identifies all running tasks for the specified service
2. Finds all containers within those tasks
3. Locates the appropriate CloudWatch log streams
4. Fetches the specified number of log entries from each container
5. Optionally sorts all entries by timestamp for a consolidated view
6. Displays log entries with color-coded prefixes and timestamps

## Troubleshooting

### Common Issues

1. **No logs found**: Check that your service is running and producing logs.
2. **Permission errors**: Verify your AWS credentials have the necessary permissions.
3. **AWS CLI errors**: Make sure you have the latest version of AWS CLI.
4. **Timeouts**: Very large log volumes might cause timeouts; try reducing the `LOG_COUNT`.

### Debug Steps

1. Verify AWS credentials: `aws sts get-caller-identity`
2. Check ECS service: `aws ecs describe-services --cluster your-cluster --services your-service`
3. Inspect CloudWatch logs manually: `aws logs describe-log-groups`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.