-- Runs once, when the database volume is first created.
-- A separate database so tests never touch real data.
CREATE DATABASE tracker_test OWNER tracker;
