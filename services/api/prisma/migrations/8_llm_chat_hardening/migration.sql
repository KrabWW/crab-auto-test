-- Hardening for llm-chat: atomic message sequence allocation and session/project consistency.

ALTER TABLE "ChatSession"
  ADD COLUMN "nextMessageSequence" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "ChatSession_id_projectId_key" ON "ChatSession"("id", "projectId");
CREATE UNIQUE INDEX "ChatMessage_id_projectId_key" ON "ChatMessage"("id", "projectId");

ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_sessionId_fkey";
ALTER TABLE "ChatActivity" DROP CONSTRAINT "ChatActivity_sessionId_fkey";
ALTER TABLE "ChatGeneratedArtifact" DROP CONSTRAINT "ChatGeneratedArtifact_sessionId_fkey";
ALTER TABLE "ChatGeneratedArtifact" DROP CONSTRAINT "ChatGeneratedArtifact_messageId_fkey";

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_projectId_fkey"
  FOREIGN KEY ("sessionId", "projectId") REFERENCES "ChatSession"("id", "projectId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatActivity" ADD CONSTRAINT "ChatActivity_sessionId_projectId_fkey"
  FOREIGN KEY ("sessionId", "projectId") REFERENCES "ChatSession"("id", "projectId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatGeneratedArtifact" ADD CONSTRAINT "ChatGeneratedArtifact_sessionId_projectId_fkey"
  FOREIGN KEY ("sessionId", "projectId") REFERENCES "ChatSession"("id", "projectId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatGeneratedArtifact" ADD CONSTRAINT "ChatGeneratedArtifact_messageId_projectId_fkey"
  FOREIGN KEY ("messageId", "projectId") REFERENCES "ChatMessage"("id", "projectId")
  ON DELETE CASCADE ON UPDATE CASCADE;