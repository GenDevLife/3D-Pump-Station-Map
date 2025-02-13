import ModbusRTU from 'modbus-serial';
import http from 'http';
import { Server } from 'socket.io';

// ========================= Configuration =========================
const CONFIG = {
  MODBUS_HOST: '127.0.0.1',
  MODBUS_PORT: 502,
  MODBUS_ID: 1,
  SERVER_PORT: 3001,

  MAX_RETRIES: 15,
  RETRY_INTERVAL: 15000,

  READ_INTERVAL: 2000,

  REGISTER_RANGES: [
    { start: 0,   length: 70, name: 'Batch 1A' },
  ],
  TOTAL_REGISTERS: 70
};

// ========================= System Initialization =========================
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET","POST"]
  }
});
const client = new ModbusRTU();

let dataBuffer = new Array(CONFIG.TOTAL_REGISTERS).fill(0);
let modbusLoopInterval = null;
let retryCount = 0;

// ========================= Connect Modbus =========================
async function connectModbus() {
  try {
    clearInterval(modbusLoopInterval);
    modbusLoopInterval = null;

    if (client.isOpen) await client.close();

    await client.connectTCP(CONFIG.MODBUS_HOST, { port: CONFIG.MODBUS_PORT });
    client.setID(CONFIG.MODBUS_ID);
    client.setTimeout(5000);

    console.log('Modbus connected successfully');
    retryCount = 0;
    startModbusLoop();
  } catch (err) {
    handleConnectionError(err);
  }
}

function handleConnectionError(err) {
  console.error(`Connection Error: ${err.message}`);
  if (retryCount++ < CONFIG.MAX_RETRIES) {
    console.log(`Retrying... (${retryCount}/${CONFIG.MAX_RETRIES})`);
    setTimeout(connectModbus, CONFIG.RETRY_INTERVAL);
  } else {
    console.error('Maximum retries reached');
  }
}

// ========================= Read & Process Data =========================
async function processBatchesSequential() {
  const newBuffer = dataBuffer.slice();

  for (const range of CONFIG.REGISTER_RANGES) {
    try {
      const response = await client.readHoldingRegisters(range.start, range.length);
      const batchData = response.data;

      for (let i = 0; i < batchData.length; i++) {
        newBuffer[range.start + i] = batchData[i];
      }
    } catch (error) {
      console.error(`Read Error [${range.name}]: ${error.message}`);
    }
  }

  dataBuffer = newBuffer;
  io.emit('modbusData', dataBuffer);
}

// ========================= Main Loop =========================
function startModbusLoop() {
  console.log('Starting data monitoring...');

  modbusLoopInterval = setInterval(async () => {
    if (!client.isOpen) {
      await connectModbus();
      return;
    }
    try {
      await processBatchesSequential();
    } catch (error) {
      console.error(`Processing Error: ${error.message}`);
      await connectModbus();
    }
  }, CONFIG.READ_INTERVAL);
}

// ========================= Client Connection =========================
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('modbusData', dataBuffer);
});

// ========================= Graceful Shutdown =========================
async function shutdown() {
  console.log('\nSystem shutdown initiated...');
  clearInterval(modbusLoopInterval);

  io.close(() => console.log('Socket.io closed'));

  if (client.isOpen) {
    try {
      await client.close();
      console.log('Modbus connection closed');
    } catch (err) {
      console.error('Error closing Modbus:', err.message);
    }
  }

  server.close(() => {
    console.log('HTTP server terminated');
    process.exit(0);
  });

  setTimeout(() => {
    console.warn('Force shutdown');
    process.exit(1);
  }, 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ========================= Startup =========================
server.listen(CONFIG.SERVER_PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${CONFIG.SERVER_PORT}`);
  connectModbus();
});