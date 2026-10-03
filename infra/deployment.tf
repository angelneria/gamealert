# Terraform configuration for production deployment (optional)
# Supports AWS, GCP, and Azure

# Example: AWS ECS Fargate
# resource "aws_ecs_service" "gamealert" {
#   name            = "gamealert"
#   cluster         = aws_ecs_cluster.main.id
#   task_definition = aws_ecs_task_definition.app.arn
#   desired_count   = 2
# }

# Example: PostgreSQL RDS
# resource "aws_db_instance" "gamealert" {
#   identifier     = "gamealert-db"
#   engine         = "postgres"
#   engine_version = "16"
#   instance_class = "db.t3.micro"
#   allocated_storage = 20
# }

# Example: Redis ElastiCache
# resource "aws_elasticache_replication_group" "gamealert" {
#   replication_group_id = "gamealert-redis"
#   engine               = "redis"
#   node_type            = "cache.t3.micro"
#   num_cache_clusters   = 1
# }
