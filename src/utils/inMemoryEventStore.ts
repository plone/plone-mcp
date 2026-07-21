import { randomUUID } from "node:crypto";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { EventStore, StreamId, EventId } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

/**
 * In-memory implementation of the EventStore interface.
 * Useful for testing and simple use cases.
 */
export class InMemoryEventStore implements EventStore {
  private events = new Map<EventId, { streamId: StreamId; message: JSONRPCMessage }>();
  private streamEvents = new Map<StreamId, EventId[]>();

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    const eventId = randomUUID();
    this.events.set(eventId, { streamId, message });
    
    const ids = this.streamEvents.get(streamId) || [];
    ids.push(eventId);
    this.streamEvents.set(streamId, ids);
    
    return eventId;
  }

  async getStreamIdForEventId(eventId: EventId): Promise<StreamId | undefined> {
    return this.events.get(eventId)?.streamId;
  }

  async replayEventsAfter(lastEventId: EventId, { send }: {
    send: (eventId: EventId, message: JSONRPCMessage) => Promise<void>;
  }): Promise<StreamId> {
    const lastEvent = this.events.get(lastEventId);
    if (!lastEvent) {
      throw new Error(`Event ${lastEventId} not found`);
    }

    const { streamId } = lastEvent;
    const ids = this.streamEvents.get(streamId) || [];
    const index = ids.indexOf(lastEventId);

    if (index !== -1) {
      for (let i = index + 1; i < ids.length; i++) {
        const id = ids[i];
        const event = this.events.get(id);
        if (event) {
          await send(id, event.message);
        }
      }
    }

    return streamId;
  }
}
