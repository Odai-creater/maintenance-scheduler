# Equipment Maintenance Scheduler (AWS Lambda)

A factory equipment preventive maintenance scheduling service running on AWS Lambda + API Gateway + DynamoDB.

## Overview

This service manages preventive maintenance schedules for production equipment across Toyota plants.
It tracks upcoming and overdue maintenance tasks, records completed work, and provides plant-level visibility.

## Architecture

- **AWS Lambda** — Serverless compute for all API endpoints
- **API Gateway (HTTP API)** — Request routing and HTTPS termination
- **DynamoDB** — Persistent storage for schedules and maintenance history
- **Region** — ap-northeast-1 (Tokyo)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/schedules` | Register a maintenance schedule |
| GET | `/schedules` | Get schedules (filter by plant, status, or overdue) |
| PATCH | `/schedules/:id/complete` | Mark a maintenance task as completed |
| GET | `/history` | Get maintenance history |

## Request Examples

### Register a maintenance schedule
```bash
curl -X POST https://<api-gateway-url>/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "EQ-WELD-001",
    "equipmentName": "Welding Robot Arm #1",
    "plantId": "PLANT-TAKAOKA",
    "maintenanceType": "preventive",
    "scheduledAt": "2026-06-01T08:00:00Z",
    "assignedTo": "Tanaka Kenji"
  }'
```

### Get overdue maintenance at a plant
```bash
curl "https://<api-gateway-url>/schedules?plantId=PLANT-TAKAOKA&overdue=true"
```

### Complete a maintenance task
```bash
curl -X PATCH https://<api-gateway-url>/schedules/<schedule-id>/complete \
  -H "Content-Type: application/json" \
  -d '{
    "completedBy": "Tanaka Kenji",
    "notes": "Replaced worn bearing. All checks passed."
  }'
```

### Get maintenance history
```bash
curl "https://<api-gateway-url>/history?plantId=PLANT-TAKAOKA"
```

## Local Development

```bash
npm install
npm start
```

## Deployment

```bash
npm run deploy
```

## Migration from On-Premise

This service was migrated from an on-premise Express.js server with in-memory storage to achieve:

- **Durability**: Maintenance records persisted in DynamoDB — never lost
- **Pay-per-use**: Zero cost during off-shift and holiday periods
- **Unified visibility**: All plants share a single maintenance schedule view
- **High availability**: 99.95% SLA across all plant locations
- **Zero ops burden**: No per-plant server management required
