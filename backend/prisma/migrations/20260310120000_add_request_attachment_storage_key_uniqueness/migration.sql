CREATE UNIQUE INDEX IF NOT EXISTS "request_attachments_request_id_storage_key_key"
ON "request_attachments"("request_id", "storage_key");
