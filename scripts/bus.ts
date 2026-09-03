import { EventEmitter } from "node:events";

export type IngestNotice = {
  file: string;
  events: number;
  days: string[];
  mode?: string;
};

class IngestBus extends EventEmitter {
  seq = 0;
  last: IngestNotice | null = null;

  note(notice: IngestNotice) {
    this.seq += 1;
    this.last = notice;
    this.emit("ingest", notice);
  }
}

export const bus = new IngestBus();
