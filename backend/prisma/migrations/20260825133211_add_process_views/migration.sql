-- CreateTable
CREATE TABLE "process_views" (
    "user_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_movement_date" TIMESTAMPTZ,

    CONSTRAINT "process_views_pkey" PRIMARY KEY ("user_id","process_id")
);

-- CreateIndex
CREATE INDEX "process_views_user_id_idx" ON "process_views"("user_id");

-- AddForeignKey
ALTER TABLE "process_views" ADD CONSTRAINT "process_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_views" ADD CONSTRAINT "process_views_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
