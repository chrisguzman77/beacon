-- docs/platform-guide.md section 2. Run once by db.init_schema() when the sites table does not exist.
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE sites (site_id int PRIMARY KEY, name text, state text, county text, lat double precision, lon double precision,
  tz text, tech text, mw double precision, coastal bool, river bool, sfha bool, beacon bool DEFAULT false);
CREATE TABLE crew (crew_id serial PRIMARY KEY, site_id int REFERENCES sites, name text, auth0_sub text, phone text);
CREATE TABLE conditions (ts timestamptz NOT NULL, site_id int NOT NULL, source text NOT NULL,
  temp_c real, humidity real, heat_index_f real, precip_mm real, soil real, discharge real, water_depth_mm real,
  wind_gust_kmh real, light smallint, PRIMARY KEY (site_id, ts, source));
SELECT create_hypertable('conditions', 'ts');
CREATE TABLE events (ts timestamptz NOT NULL, site_id int NOT NULL, source text NOT NULL, type text NOT NULL, payload jsonb);
SELECT create_hypertable('events', 'ts');
CREATE INDEX ON events (site_id, ts DESC);
CREATE TABLE strikes (ts timestamptz NOT NULL, lat double precision, lon double precision, source text, site_id int, distance_m real);
SELECT create_hypertable('strikes', 'ts');
CREATE TABLE alerts (alert_id serial PRIMARY KEY, site_id int, type text, started timestamptz, expires timestamptz, cleared timestamptz,
  cleared_by text, payload jsonb);
CREATE TABLE reports (report_id serial PRIMARY KEY, site_id int, ts timestamptz, crew_id int, lat double precision, lon double precision,
  photo_path text, tag text, description text, confidence real, note text);
CREATE TABLE briefings (site_id int, for_date date, generated timestamptz, english text, spanish text, payload jsonb, source text,
  PRIMARY KEY (site_id, for_date));
CREATE TABLE hazard_index (site_id int, for_date date, probability real, index smallint, top_features jsonb, PRIMARY KEY (site_id, for_date));
CREATE TABLE checkins (ts timestamptz NOT NULL, site_id int, crew_id int, action text);
SELECT create_hypertable('checkins', 'ts');
-- continuous aggregates for the dashboard
CREATE MATERIALIZED VIEW site_hourly WITH (timescaledb.continuous) AS
  SELECT site_id, time_bucket('1 hour', ts) AS bucket, max(heat_index_f) AS heat_max, sum(precip_mm) AS precip,
         max(wind_gust_kmh) AS gust_max, avg(soil) AS soil, max(water_depth_mm) AS water
  FROM conditions GROUP BY site_id, bucket;
SELECT add_continuous_aggregate_policy('site_hourly', start_offset => INTERVAL '3 days', end_offset => INTERVAL '10 minutes', schedule_interval => INTERVAL '10 minutes');
CREATE MATERIALIZED VIEW site_daily WITH (timescaledb.continuous) AS
  SELECT site_id, time_bucket('1 day', ts) AS bucket, max(heat_index_f) AS heat_max, sum(precip_mm) AS precip, max(wind_gust_kmh) AS gust_max
  FROM conditions GROUP BY site_id, bucket;
SELECT add_continuous_aggregate_policy('site_daily', start_offset => INTERVAL '30 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '1 hour');
-- compression
ALTER TABLE conditions SET (timescaledb.compress, timescaledb.compress_segmentby = 'site_id');
SELECT add_compression_policy('conditions', INTERVAL '1 day');
