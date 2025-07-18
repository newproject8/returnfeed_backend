import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import pool from '../db';
import logger from '../utils/logger';

export interface WebSocketClient {
  ws: WebSocket;
  id: string;
  sessionId?: string;
  role?: 'pd' | 'staff' | 'viewer';
  userId?: number;
  cameraNumber?: number;
}

export interface TallyUpdate {
  program: number | null;
  preview: number | null;
  inputs: { [key: number]: string };
}

export class ReturnFeedWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private sessionClients: Map<string, Set<string>> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    logger.info('WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage) {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      ws,
      id: clientId
    };

    this.clients.set(clientId, client);
    logger.info(`WebSocket client connected: ${clientId}`);

    // Extract session info from URL or headers
    this.extractSessionInfo(client, request);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(client, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error);
        this.sendError(client, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(client);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(client);
    });

    // Send welcome message
    this.sendMessage(client, {
      type: 'connected',
      clientId: clientId,
      timestamp: new Date().toISOString()
    });
  }

  private extractSessionInfo(client: WebSocketClient, request: IncomingMessage) {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const sessionId = url.searchParams.get('sessionId');
      const token = url.searchParams.get('token');

      if (sessionId) {
        client.sessionId = sessionId;
        this.addClientToSession(client);
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
          client.userId = decoded.id;
          client.role = decoded.role || 'viewer';
        } catch (error) {
          logger.warn('Invalid JWT token in WebSocket connection');
        }
      }
    } catch (error) {
      logger.error('Failed to extract session info:', error);
    }
  }

  private handleMessage(client: WebSocketClient, message: any) {
    logger.debug(`Received message from ${client.id}:`, message);

    switch (message.type) {
      case 'register':
        this.handleRegister(client, message);
        break;
      case 'tally_update':
        this.handleTallyUpdate(client, message);
        break;
      case 'inputs_update':
        this.handleInputsUpdate(client, message);
        break;
      case 'get_full_state':
        this.handleGetFullState(client);
        break;
      case 'get_inputs':
        this.handleGetInputs(client);
        break;
      case 'ping':
        this.sendMessage(client, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      default:
        logger.warn(`Unknown message type: ${message.type}`);
        this.sendError(client, `Unknown message type: ${message.type}`);
    }
  }

  private handleRegister(client: WebSocketClient, message: any) {
    const { sessionId, role, cameraNumber } = message;

    if (sessionId) {
      client.sessionId = sessionId;
      this.addClientToSession(client);
    }

    if (role) {
      client.role = role;
    }

    if (cameraNumber !== undefined) {
      client.cameraNumber = cameraNumber;
    }

    this.sendMessage(client, {
      type: 'session_registered',
      sessionId: client.sessionId,
      role: client.role,
      cameraNumber: client.cameraNumber
    });

    logger.info(`Client registered: ${client.id} (session: ${sessionId}, role: ${role})`);

    // Send current tally state if available
    this.sendCurrentTallyState(client);
  }

  private async handleTallyUpdate(client: WebSocketClient, message: any) {
    const { program, preview, inputs, sessionId } = message;

    // Validate that client has permission to send tally updates
    if (client.role !== 'pd') {
      this.sendError(client, 'Only PD users can send tally updates');
      return;
    }

    const tallyUpdate: TallyUpdate = {
      program: program || null,
      preview: preview || null,
      inputs: inputs || {}
    };

    // Store tally state in database
    try {
      await this.storeTallyState(sessionId || client.sessionId, tallyUpdate);
    } catch (error) {
      logger.error('Failed to store tally state:', error);
    }

    // Broadcast to all clients in the session
    this.broadcastToSession(sessionId || client.sessionId, {
      type: 'tally_update',
      ...tallyUpdate,
      timestamp: new Date().toISOString()
    });

    logger.info(`Tally update broadcasted for session: ${sessionId || client.sessionId}`);
  }

  private async handleInputsUpdate(client: WebSocketClient, message: any) {
    const { inputs, sessionId, vmixVersion, timestamp } = message;

    // Validate that client has permission to send inputs updates
    if (client.role !== 'pd') {
      this.sendError(client, 'Only PD users can send inputs updates');
      return;
    }

    const targetSessionId = sessionId || client.sessionId;
    if (!targetSessionId) {
      this.sendError(client, 'No session ID provided');
      return;
    }

    // Store inputs data in database
    try {
      await this.storeInputsData(targetSessionId, inputs, vmixVersion);
    } catch (error) {
      logger.error('Failed to store inputs data:', error);
    }

    // Broadcast to all clients in the session
    this.broadcastToSession(targetSessionId, {
      type: 'inputs_update',
      inputs: inputs || {},
      vmixVersion: vmixVersion,
      timestamp: timestamp || new Date().toISOString()
    });

    logger.info(`Inputs update broadcasted for session: ${targetSessionId}, input count: ${Object.keys(inputs || {}).length}`);
  }

  private async handleGetInputs(client: WebSocketClient) {
    if (!client.sessionId) {
      this.sendError(client, 'No session ID provided');
      return;
    }

    try {
      const inputsData = await this.getInputsData(client.sessionId);
      this.sendMessage(client, {
        type: 'inputs_list',
        inputs: inputsData.inputs,
        vmixVersion: inputsData.vmixVersion,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get inputs data:', error);
      this.sendError(client, 'Failed to get inputs data');
    }
  }

  private async handleGetFullState(client: WebSocketClient) {
    if (!client.sessionId) {
      this.sendError(client, 'No session ID provided');
      return;
    }

    try {
      const tallyState = await this.getTallyState(client.sessionId);
      this.sendMessage(client, {
        type: 'full_state',
        ...tallyState,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get full state:', error);
      this.sendError(client, 'Failed to get session state');
    }
  }

  private async sendCurrentTallyState(client: WebSocketClient) {
    if (!client.sessionId) return;

    try {
      const tallyState = await this.getTallyState(client.sessionId);
      this.sendMessage(client, {
        type: 'tally_update',
        ...tallyState,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send current tally state:', error);
    }
  }

  private async storeTallyState(sessionId: string, tallyUpdate: TallyUpdate) {
    const client = await pool.connect();
    try {
      // Update stream_configs table with latest tally state
      await client.query(`
        INSERT INTO stream_configs (session_id, tally_program, tally_preview, input_list, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (session_id) 
        DO UPDATE SET 
          tally_program = EXCLUDED.tally_program,
          tally_preview = EXCLUDED.tally_preview,
          input_list = EXCLUDED.input_list,
          updated_at = NOW()
      `, [sessionId, tallyUpdate.program, tallyUpdate.preview, JSON.stringify(tallyUpdate.inputs)]);

    } finally {
      client.release();
    }
  }

  private async storeInputsData(sessionId: string, inputs: any, vmixVersion?: string) {
    const client = await pool.connect();
    try {
      // Update stream_configs table with latest inputs data
      await client.query(`
        INSERT INTO stream_configs (session_id, input_list, vmix_version, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (session_id) 
        DO UPDATE SET 
          input_list = EXCLUDED.input_list,
          vmix_version = EXCLUDED.vmix_version,
          updated_at = NOW()
      `, [sessionId, JSON.stringify(inputs), vmixVersion || 'unknown']);

    } finally {
      client.release();
    }
  }

  private async getInputsData(sessionId: string): Promise<{ inputs: any; vmixVersion?: string }> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT input_list, vmix_version
        FROM stream_configs
        WHERE session_id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        return { inputs: {}, vmixVersion: 'unknown' };
      }

      const row = result.rows[0];
      return {
        inputs: row.input_list ? JSON.parse(row.input_list) : {},
        vmixVersion: row.vmix_version || 'unknown'
      };
    } finally {
      client.release();
    }
  }

  private async getTallyState(sessionId: string): Promise<TallyUpdate> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT tally_program, tally_preview, input_list
        FROM stream_configs
        WHERE session_id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        return { program: null, preview: null, inputs: {} };
      }

      const row = result.rows[0];
      return {
        program: row.tally_program,
        preview: row.tally_preview,
        inputs: row.input_list ? JSON.parse(row.input_list) : {}
      };
    } finally {
      client.release();
    }
  }

  private addClientToSession(client: WebSocketClient) {
    if (!client.sessionId) return;

    if (!this.sessionClients.has(client.sessionId)) {
      this.sessionClients.set(client.sessionId, new Set());
    }

    this.sessionClients.get(client.sessionId)!.add(client.id);
  }

  private removeClientFromSession(client: WebSocketClient) {
    if (!client.sessionId) return;

    const sessionClients = this.sessionClients.get(client.sessionId);
    if (sessionClients) {
      sessionClients.delete(client.id);
      if (sessionClients.size === 0) {
        this.sessionClients.delete(client.sessionId);
      }
    }
  }

  public broadcastToSession(sessionId: string, message: any) {
    const sessionClients = this.sessionClients.get(sessionId);
    if (!sessionClients) {
      logger.warn(`No clients found for session: ${sessionId}`);
      return;
    }

    let broadcastCount = 0;
    for (const clientId of sessionClients) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(client, message);
        broadcastCount++;
      }
    }

    logger.debug(`Broadcasted message to ${broadcastCount} clients in session ${sessionId}`);
  }

  private sendMessage(client: WebSocketClient, message: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error(`Failed to send message to client ${client.id}:`, error);
      }
    }
  }

  private sendError(client: WebSocketClient, errorMessage: string) {
    this.sendMessage(client, {
      type: 'error',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  private handleDisconnection(client: WebSocketClient) {
    logger.info(`WebSocket client disconnected: ${client.id}`);
    
    this.removeClientFromSession(client);
    this.clients.delete(client.id);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external API integration
  public broadcastTallyUpdate(sessionId: string, tallyUpdate: TallyUpdate) {
    this.broadcastToSession(sessionId, {
      type: 'tally_update',
      ...tallyUpdate,
      timestamp: new Date().toISOString()
    });
  }

  public getConnectedClients(sessionId?: string): number {
    if (sessionId) {
      return this.sessionClients.get(sessionId)?.size || 0;
    }
    return this.clients.size;
  }

  public getSessionList(): string[] {
    return Array.from(this.sessionClients.keys());
  }

  public close() {
    this.wss.close();
    logger.info('WebSocket server closed');
  }
}