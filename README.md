# Equipment Maintenance Scheduler (On-Premise)

A factory equipment preventive maintenance scheduling service currently running on-premise.
This service will be migrated to AWS Lambda as part of the Devin demo.

## Overview

This service manages preventive maintenance schedules for production equipment across Toyota plants.
It tracks upcoming and overdue maintenance tasks, records completed work, and provides plant-level visibility.

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
curl -X POST http://localhost:3000/schedules \
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
curl "http://localhost:3000/schedules?plantId=PLANT-TAKAOKA&overdue=true"
```

### Complete a maintenance task
```bash
curl -X PATCH http://localhost:3000/schedules/1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "completedBy": "Tanaka Kenji",
    "notes": "Replaced worn bearing. All checks passed."
  }'
```

### Get maintenance history
```bash
curl "http://localhost:3000/history?plantId=PLANT-TAKAOKA"
```

## Current Issues (On-Premise)

- Server running 24/7 across all plants — high energy and maintenance cost
- No real-time visibility of overdue tasks across plants
- Cannot handle burst requests during shift changeover or emergency scheduling
- Single point of failure — server outage means maintenance records are inaccessible
- Maintenance history lost on server restart (in-memory storage)
- No automated alerts for overdue maintenance tasks

## Migration Goal

Migrate to AWS Lambda + DynamoDB to achieve:

- **Real-time overdue alerts**: Automated notifications for overdue maintenance
- **Pay-per-use**: Zero cost during off-shift and holiday periods
- **Unified visibility**: All plants share a single maintenance schedule view
- **Durability**: Maintenance records persisted in DynamoDB — never lost
- **High availability**: 99.95% SLA across all plant locations
- **Zero ops burden**: No per-plant server management required
