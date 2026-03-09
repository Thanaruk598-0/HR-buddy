-- De-duplicate legacy rows before adding uniqueness constraint.
-- Keep the oldest row per (request_id, storage_key), then repoint document_request_details.
WITH ranked AS (
  SELECT
    "id",
    "request_id",
    "storage_key",
    ROW_NUMBER() OVER (
      PARTITION BY "request_id", "storage_key"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn,
    FIRST_VALUE("id") OVER (
      PARTITION BY "request_id", "storage_key"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS keep_id
  FROM "request_attachments"
), duplicates AS (
  SELECT "id", keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE "document_request_details" AS d
SET "digital_file_attachment_id" = duplicates.keep_id
FROM duplicates
WHERE d."digital_file_attachment_id" = duplicates."id";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "request_id", "storage_key"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn
  FROM "request_attachments"
)
DELETE FROM "request_attachments" AS a
USING ranked
WHERE a."id" = ranked."id"
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "request_attachments_request_id_storage_key_key"
ON "request_attachments"("request_id", "storage_key");
