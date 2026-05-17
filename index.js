const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory maintenance store (on-premise style)
const maintenanceSchedules = [];
const maintenanceHistory = [];

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Equipment Maintenance Scheduler is running (on-premise)',
    version: '1.0.0'
  });
});

// Register a maintenance schedule
// Expected body: { equipmentId, equipmentName, plantId, maintenanceType, scheduledAt, assignedTo }
app.post('/schedules', (req, res) => {
  const { equipmentId, equipmentName, plantId, maintenanceType, scheduledAt, assignedTo } = req.body;

  if (!equipmentId || !equipmentName || !plantId || !scheduledAt) {
    return res.status(400).json({
      error: 'equipmentId, equipmentName, plantId, and scheduledAt are required'
    });
  }

  const schedule = {
    id: maintenanceSchedules.length + 1,
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

  maintenanceSchedules.push(schedule);
  console.log(`[SCHEDULE] ${equipmentName} (${equipmentId}) at ${plantId} — scheduled: ${scheduledAt}`);

  res.json({ success: true, schedule });
});

// Get schedules (filter by plantId, status, or overdue)
app.get('/schedules', (req, res) => {
  const { plantId, status, overdue } = req.query;

  let results = [...maintenanceSchedules];

  if (plantId) results = results.filter(s => s.plantId === plantId);
  if (status) results = results.filter(s => s.status === status);
  if (overdue === 'true') results = results.filter(s => s.isOverdue && s.status !== 'completed');

  res.json({ total: results.length, schedules: results });
});

// Complete a maintenance task
// Expected body: { notes, completedBy }
app.patch('/schedules/:id/complete', (req, res) => {
  const id = parseInt(req.params.id);
  const { notes, completedBy } = req.body;

  const schedule = maintenanceSchedules.find(s => s.id === id);

  if (!schedule) {
    return res.status(404).json({ error: `Schedule ID ${id} not found` });
  }

  schedule.status = 'completed';
  schedule.completedAt = new Date().toISOString();
  schedule.completedBy = completedBy || 'unknown';
  schedule.notes = notes || '';

  const record = {
    id: maintenanceHistory.length + 1,
    scheduleId: schedule.id,
    equipmentId: schedule.equipmentId,
    equipmentName: schedule.equipmentName,
    plantId: schedule.plantId,
    maintenanceType: schedule.maintenanceType,
    completedAt: schedule.completedAt,
    completedBy: schedule.completedBy,
    notes: schedule.notes,
  };

  maintenanceHistory.push(record);
  console.log(`[COMPLETED] ${schedule.equipmentName} maintenance completed by ${schedule.completedBy}`);

  res.json({ success: true, schedule, record });
});

// Get maintenance history
app.get('/history', (req, res) => {
  const { plantId, equipmentId } = req.query;

  let results = [...maintenanceHistory];

  if (plantId) results = results.filter(r => r.plantId === plantId);
  if (equipmentId) results = results.filter(r => r.equipmentId === equipmentId);

  res.json({ total: results.length, history: results });
});

// Start server (on-premise style - always running)
app.listen(PORT, () => {
  console.log(`Equipment Maintenance Scheduler running on port ${PORT}`);
});

module.exports = app;
