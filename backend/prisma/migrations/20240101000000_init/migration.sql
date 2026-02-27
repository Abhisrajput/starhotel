-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('Open', 'Booked', 'Occupied', 'Housekeeping', 'Maintenance');

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "street_address" TEXT NOT NULL,
    "contact_no" TEXT NOT NULL,
    "system_start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_version" TEXT NOT NULL DEFAULT '2.0.0',
    "database_version" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "currency_symbol" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" SERIAL NOT NULL,
    "group_name" VARCHAR(20) NOT NULL,
    "group_desc" VARCHAR(255) NOT NULL,
    "security_level" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data" (
    "id" SERIAL NOT NULL,
    "user_group" INTEGER NOT NULL,
    "user_id" VARCHAR(20) NOT NULL,
    "user_name" VARCHAR(50) NOT NULL,
    "user_password" VARCHAR(255) NOT NULL,
    "idle" INTEGER NOT NULL DEFAULT 0,
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "change_password" BOOLEAN NOT NULL DEFAULT false,
    "dashboard_blink" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_access" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "module_desc" VARCHAR(50) NOT NULL,
    "module_type" VARCHAR(50) NOT NULL,
    "group1" BOOLEAN NOT NULL DEFAULT false,
    "group2" BOOLEAN NOT NULL DEFAULT false,
    "group3" BOOLEAN NOT NULL DEFAULT false,
    "group4" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "module_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" SERIAL NOT NULL,
    "type_short_name" VARCHAR(30) NOT NULL,
    "type_long_name" VARCHAR(255) NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL DEFAULT 0,
    "room_short_name" VARCHAR(50) NOT NULL,
    "room_long_name" VARCHAR(255) NOT NULL DEFAULT '',
    "room_status" "RoomStatus" NOT NULL DEFAULT 'Open',
    "room_type" VARCHAR(50) NOT NULL,
    "room_location" VARCHAR(50) NOT NULL,
    "room_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "breakfast" BOOLEAN NOT NULL DEFAULT false,
    "breakfast_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(50) NOT NULL DEFAULT 'System',
    "last_modified_date" TIMESTAMP(3),
    "last_modified_by" VARCHAR(50),
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "guest_name" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_passport" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_origin" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_contact" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_emergency_contact_name" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_emergency_contact_no" VARCHAR(50) NOT NULL DEFAULT '',
    "total_guest" INTEGER NOT NULL DEFAULT 0,
    "stay_duration" INTEGER NOT NULL DEFAULT 0,
    "booking_date" TIMESTAMP(3),
    "guest_check_in" TIMESTAMP(3),
    "guest_check_out" TIMESTAMP(3),
    "remarks" TEXT NOT NULL DEFAULT '',
    "room_id" INTEGER NOT NULL DEFAULT 0,
    "room_no" VARCHAR(50) NOT NULL DEFAULT '',
    "room_type" VARCHAR(50) NOT NULL DEFAULT '',
    "room_location" VARCHAR(50) NOT NULL DEFAULT '',
    "room_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "breakfast" BOOLEAN NOT NULL DEFAULT false,
    "breakfast_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sub_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "refund" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "temp" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(50) NOT NULL DEFAULT '',
    "last_modified_date" TIMESTAMP(3),
    "last_modified_by" VARCHAR(50),
    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_bookings" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "guest_name" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_passport" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_origin" VARCHAR(50) NOT NULL DEFAULT '',
    "guest_contact" VARCHAR(50) NOT NULL DEFAULT '',
    "action" VARCHAR(50) NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(50) NOT NULL DEFAULT '',
    CONSTRAINT "log_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_rooms" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "booking_id" INTEGER NOT NULL DEFAULT 0,
    "room_short_name" VARCHAR(50) NOT NULL DEFAULT '',
    "room_status" VARCHAR(50) NOT NULL DEFAULT '',
    "action" VARCHAR(50) NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(50) NOT NULL DEFAULT '',
    CONSTRAINT "log_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_errors" (
    "id" SERIAL NOT NULL,
    "log_date_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "log_error_num" VARCHAR(50) NOT NULL DEFAULT '',
    "log_error_description" TEXT NOT NULL DEFAULT '',
    "log_user_name" VARCHAR(50) NOT NULL DEFAULT '',
    "log_module" VARCHAR(255) NOT NULL DEFAULT '',
    "log_method" VARCHAR(255) NOT NULL DEFAULT '',
    "log_type" VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT "log_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "report_name" VARCHAR(255) NOT NULL,
    "report_title" VARCHAR(255) NOT NULL,
    "report_as_on" VARCHAR(50) NOT NULL DEFAULT '',
    "show_report_as_on" BOOLEAN NOT NULL DEFAULT false,
    "date_field" VARCHAR(50) NOT NULL DEFAULT '',
    "date_type" VARCHAR(50) NOT NULL DEFAULT '',
    "report_query" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_data_user_id_key" ON "user_data"("user_id");

-- AddForeignKey
ALTER TABLE "user_data" ADD CONSTRAINT "user_data_user_group_fkey" FOREIGN KEY ("user_group") REFERENCES "user_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;