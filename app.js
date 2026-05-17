const express = require('express');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE || 'maintenance-scheduler-prod-schedules';
const HISTORY_TABLE = process.env.HISTORY_TABLE || 'maintenance-scheduler-prod-history';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Equipment Maintenance Scheduler is running on AWS Lambda',
    version: '2.0.0'
  });
});

// Register a maintenance schedule
app.post('/schedules', async (req, res) => {
  const { equipmentId, equipmentName, plantId, maintenanceType, scheduledAt, assignedTo } = req.body;

  if (!equipmentId || !equipmentName || !plantId || !scheduledAt) {
    return res.status(400).json({
      error: 'equipmentId, equipmentName, plantId, and scheduledAt are required'
    });
  }

  const schedule = {
    id: uuidv4(),
    equipmentId,
    equipmentName,
    plantId,
    maintenanceType: maintenanceType || 'routine',
    scheduledAt,
    assignedTo: assignedTo || 'unassigned',
    status: 'scheduled',
    isOverdue: new Date(scheduledAt) < new Date(),
    createdAt: new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({
      TableName: SCHEDULES_TABLE,
      Item: schedule,
    }));
    console.log(`[SCHEDULE] ${equipmentName} (${equipmentId}) at ${plantId} — scheduled: ${scheduledAt}`);
    res.json({ success: true, schedule });
  } catch (err) {
    console.error('[DYNAMODB ERROR]', err);
    res.status(500).json({ error: 'Failed to store schedule' });
  }
});

// Get schedules (filter by plantId, status, or overdue)
app.get('/schedules', async (req, res) => {
  const { plantId, status, overdue } = req.query;

  try {
    const result = await docClient.send(new ScanCommand({
      TableName: SCHEDULES_TABLE,
    }));
    let results = result.Items || [];

    // Recompute isOverdue dynamically
    const now = new Date();
    results = results.map(s => ({
      ...s,
      isOverdue: new Date(s.scheduledAt) < now && s.status !== 'completed',
    }));

    if (plantId) results = results.filter(s => s.plantId === plantId);
    if (status) results = results.filter(s => s.status === status);
    if (overdue === 'true') results = results.filter(s => s.isOverdue && s.status !== 'completed');

    res.json({ total: results.length, schedules: results });
  } catch (err) {
    console.error('[DYNAMODB ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve schedules' });
  }
});

// Complete a maintenance task
app.patch('/schedules/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { notes, completedBy } = req.body;

  try {
    const getResult = await docClient.send(new GetCommand({
      TableName: SCHEDULES_TABLE,
      Key: { id },
    }));
    const schedule = getResult.Item;

    if (!schedule) {
      return res.status(404).json({ error: `Schedule ID ${id} not found` });
    }

    const completedAt = new Date().toISOString();
    const completedByValue = completedBy || 'unknown';
    const notesValue = notes || '';

    // Update the schedule in DynamoDB
    await docClient.send(new UpdateCommand({
      TableName: SCHEDULES_TABLE,
      Key: { id },
      UpdateExpression: 'SET #status = :status, completedAt = :completedAt, completedBy = :completedBy, notes = :notes',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':completedAt': completedAt,
        ':completedBy': completedByValue,
        ':notes': notesValue,
      },
    }));

    // Record in history table
    const record = {
      id: uuidv4(),
      scheduleId: schedule.id,
      equipmentId: schedule.equipmentId,
      equipmentName: schedule.equipmentName,
      plantId: schedule.plantId,
      maintenanceType: schedule.maintenanceType,
      completedAt,
      completedBy: completedByValue,
      notes: notesValue,
    };

    await docClient.send(new PutCommand({
      TableName: HISTORY_TABLE,
      Item: record,
    }));

    const updatedSchedule = { ...schedule, status: 'completed', completedAt, completedBy: completedByValue, notes: notesValue };
    console.log(`[COMPLETED] ${schedule.equipmentName} maintenance completed by ${completedByValue}`);

    res.json({ success: true, schedule: updatedSchedule, record });
  } catch (err) {
    console.error('[DYNAMODB ERROR]', err);
    res.status(500).json({ error: 'Failed to complete schedule' });
  }
});

// Get maintenance history
app.get('/history', async (req, res) => {
  const { plantId, equipmentId } = req.query;

  try {
    const result = await docClient.send(new ScanCommand({
      TableName: HISTORY_TABLE,
    }));
    let results = result.Items || [];

    if (plantId) results = results.filter(r => r.plantId === plantId);
    if (equipmentId) results = results.filter(r => r.equipmentId === equipmentId);

    res.json({ total: results.length, history: results });
  } catch (err) {
    console.error('[DYNAMODB ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

module.exports = app;
