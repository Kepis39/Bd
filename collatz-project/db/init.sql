-- ============================================================
-- БАЗА ДАННЫХ ГИПОТЕЗЫ КОЛЛАТЦА
-- ============================================================

CREATE TABLE IF NOT EXISTS collatz_runs (
    id SERIAL PRIMARY KEY,
    start_number BIGINT NOT NULL,
    total_steps INTEGER,
    max_value BIGINT,
    reached_one BOOLEAN DEFAULT FALSE,
    mode VARCHAR(20) NOT NULL DEFAULT 'until_one',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collatz_steps (
    id SERIAL PRIMARY KEY,
    run_id INTEGER REFERENCES collatz_runs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    value BIGINT NOT NULL,
    operation VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collatz_frequency (
    value BIGINT PRIMARY KEY,
    occurrence_count INTEGER DEFAULT 1,
    first_seen_in_run INTEGER REFERENCES collatz_runs(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_steps_run_id ON collatz_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_steps_value ON collatz_steps(value);
CREATE INDEX IF NOT EXISTS idx_frequency_count ON collatz_frequency(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_runs_start ON collatz_runs(start_number);

CREATE OR REPLACE VIEW v_top_repeating_numbers AS
SELECT 
    value,
    occurrence_count,
    CASE 
        WHEN value % 2 = 0 THEN 'чётное'
        ELSE 'нечётное'
    END AS parity
FROM collatz_frequency
ORDER BY occurrence_count DESC
LIMIT 50;

CREATE OR REPLACE VIEW v_run_statistics AS
SELECT 
    r.id,
    r.start_number,
    r.total_steps,
    r.max_value,
    r.reached_one,
    r.mode,
    r.created_at,
    (SELECT COUNT(DISTINCT s.value) FROM collatz_steps s WHERE s.run_id = r.id) AS unique_values
FROM collatz_runs r
ORDER BY r.created_at DESC;

CREATE OR REPLACE FUNCTION generate_collatz_sequence(start_val BIGINT, max_steps INTEGER DEFAULT 10000)
RETURNS TABLE(step_num INTEGER, val BIGINT, op VARCHAR) AS $$
DECLARE
    current_val BIGINT := start_val;
    step INTEGER := 0;
BEGIN
    step_num := step;
    val := current_val;
    op := 'start';
    RETURN NEXT;
    
    WHILE current_val != 1 AND step < max_steps LOOP
        step := step + 1;
        IF current_val % 2 = 0 THEN
            current_val := current_val / 2;
            step_num := step;
            val := current_val;
            op := 'n/2';
        ELSE
            current_val := current_val * 3 + 1;
            step_num := step;
            val := current_val;
            op := '3n+1';
        END IF;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_common_values(num1 BIGINT, num2 BIGINT)
RETURNS TABLE(common_value BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT a.val
    FROM generate_collatz_sequence(num1) a
    INTERSECT
    SELECT b.val
    FROM generate_collatz_sequence(num2) b
    ORDER BY 1;
END;
$$ LANGUAGE plpgsql;
