-- ApsaraDB RDS (PostgreSQL)
-- Run once before first deploy via DMS console or psql client:
--   psql -h <endpoint> -U <user> -d <dbname> -f ddl.sql

CREATE TABLE IF NOT EXISTS nfp_mule (
    id              SERIAL PRIMARY KEY,
    bank_swift_code VARCHAR NOT NULL,
    bank_account    VARCHAR NOT NULL,
    mykad_num       VARCHAR NOT NULL DEFAULT '',
    bric_num        VARCHAR NOT NULL DEFAULT '',
    police_id       VARCHAR NOT NULL DEFAULT '',
    army_id         VARCHAR NOT NULL DEFAULT '',
    unhcr_num       VARCHAR NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ix_nfp_mule_bank_swift_code
    ON nfp_mule (bank_swift_code);


CREATE TABLE IF NOT EXISTS semakmule_mule (
    id              SERIAL PRIMARY KEY,
    bank_swift_code VARCHAR NOT NULL,
    bank_account    VARCHAR NOT NULL,
    phone_num       VARCHAR NOT NULL DEFAULT '',
    company_name    VARCHAR NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ix_semakmule_mule_bank_swift_code
    ON semakmule_mule (bank_swift_code);
