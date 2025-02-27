# Fargate Log Functions for .zshrc
# Add these functions to your .zshrc file

# Function to tail Fargate logs in real-time
fargate_logs() {
  # Default values
  local region=${1:-$FARGATE_DEFAULT_REGION}
  local cluster=${2:-$FARGATE_DEFAULT_CLUSTER}
  local service=${3:-$FARGATE_DEFAULT_SERVICE}
  
  # Check if required parameters are provided
  if [[ -z "$region" || -z "$cluster" || -z "$service" ]]; then
    echo "Usage: fargate_logs [region] [cluster] [service]"
    echo "  or set defaults with: export FARGATE_DEFAULT_REGION=your-region"
    echo "                        export FARGATE_DEFAULT_CLUSTER=your-cluster"
    echo "                        export FARGATE_DEFAULT_SERVICE=your-service"
    return 1
  fi
  
  echo "Tailing logs for $service in $cluster ($region)..."
  
  # Run the Deno script from URL
  CLUSTER_NAME="$cluster" SERVICE_NAME="$service" AWS_REGION="$region" \
  deno run --allow-net --allow-run --allow-env https://raw.githubusercontent.com/username/repo/main/fargate-logs.ts
}

# Function to fetch the latest N logs
fargate_latest_logs() {
  # Default values
  local region=${1:-$FARGATE_DEFAULT_REGION}
  local cluster=${2:-$FARGATE_DEFAULT_CLUSTER}
  local service=${3:-$FARGATE_DEFAULT_SERVICE}
  local count=${4:-100}
  local hours=${5:-24}
  local sort=${6:-"true"}
  
  # Check if required parameters are provided
  if [[ -z "$region" || -z "$cluster" || -z "$service" ]]; then
    echo "Usage: fargate_latest_logs [region] [cluster] [service] [count] [hours] [sort]"
    echo "  or set defaults with: export FARGATE_DEFAULT_REGION=your-region"
    echo "                        export FARGATE_DEFAULT_CLUSTER=your-cluster"
    echo "                        export FARGATE_DEFAULT_SERVICE=your-service"
    return 1
  fi
  
  echo "Fetching $count latest logs from the past $hours hours for $service in $cluster ($region)..."
  
  # Run the Deno script from URL
  CLUSTER_NAME="$cluster" SERVICE_NAME="$service" AWS_REGION="$region" \
  LOG_COUNT="$count" TIME_RANGE_HOURS="$hours" SORT_BY_TIME="$sort" \
  deno run --allow-net --allow-run --allow-env https://raw.githubusercontent.com/username/repo/main/fargate-latest-logs.ts
}

# Optional: Add autocompletion for your regions, clusters and services
_fargate_logs_complete() {
  local regions
  local clusters
  local services
  local curr_word=$words[CURRENT]
  local prev_word=$words[CURRENT-1]

  # If completing the first argument, suggest regions
  if [[ $CURRENT -eq 2 ]]; then
    regions=("eu-west-1" "eu-west-2" "eu-west-3" "eu-central-1" "us-east-1" "us-east-2" "us-west-1" "us-west-2")
    _describe 'regions' regions
  # If completing the second argument, suggest clusters
  elif [[ $CURRENT -eq 3 ]]; then
    # You could dynamically fetch these with:
    # clusters=$(aws ecs list-clusters --query 'clusterArns[*]' --output text | awk -F/ '{print $NF}')
    clusters=("main-backend" "staging" "production")
    _describe 'clusters' clusters
  # If completing the third argument, suggest services
  elif [[ $CURRENT -eq 4 ]]; then
    # You could dynamically fetch these based on the selected cluster:
    # services=$(aws ecs list-services --cluster $prev_word --query 'serviceArns[*]' --output text | awk -F/ '{print $NF}')
    services=("orteliusdev" "auth-service" "api-gateway")
    _describe 'services' services
  fi
}

# Register the completion functions
compdef _fargate_logs_complete fargate_logs
compdef _fargate_logs_complete fargate_latest_logs

# Add aliases for convenience
alias ftl='fargate_logs'
alias fll='fargate_latest_logs'

# Add defaults for your most common environment
# Uncomment and customize these:
# export FARGATE_DEFAULT_REGION="eu-west-3"
# export FARGATE_DEFAULT_CLUSTER="main-backend"
# export FARGATE_DEFAULT_SERVICE="orteliusdev"