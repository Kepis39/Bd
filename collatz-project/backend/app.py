"""
Flask Backend — Гипотеза Коллатца
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://collatz_user:collatz_pass@localhost:5432/collatz')


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


def collatz_step(n):
    if n % 2 == 0:
        return n // 2, 'n/2'
    else:
        return 3 * n + 1, '3n+1'


@app.route('/api/health', methods=['GET'])
def health():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return jsonify({'status': 'ok', 'db': 'connected'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/collatz/compute', methods=['POST'])
def compute_collatz():
    data = request.get_json()
    start_number = data.get('number')
    mode = data.get('mode', 'until_one')
    max_steps = data.get('max_steps', 100000)

    if not start_number or start_number < 1:
        return jsonify({'error': 'Число должно быть положительным целым'}), 400

    start_number = int(start_number)
    sequence = []
    current = start_number
    step = 0
    max_value = current
    reached_one = False

    sequence.append({'step': 0, 'value': current, 'operation': 'start'})

    while step < max_steps:
        if current == 1 and mode == 'until_one' and step > 0:
            reached_one = True
            break

        step += 1
        current, op = collatz_step(current)
        max_value = max(max_value, current)
        sequence.append({'step': step, 'value': current, 'operation': op})

        if current == 1 and mode == 'infinite':
            reached_one = True

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute(
            """INSERT INTO collatz_runs (start_number, total_steps, max_value, reached_one, mode)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (start_number, len(sequence) - 1, max_value, reached_one, mode)
        )
        run_id = cur.fetchone()[0]

        step_data = [(run_id, s['step'], s['value'], s['operation']) for s in sequence]
        psycopg2.extras.execute_batch(
            cur,
            """INSERT INTO collatz_steps (run_id, step_number, value, operation)
               VALUES (%s, %s, %s, %s)""",
            step_data,
            page_size=500
        )

        values_in_sequence = set(s['value'] for s in sequence)
        for val in values_in_sequence:
            cur.execute(
                """INSERT INTO collatz_frequency (value, occurrence_count, first_seen_in_run)
                   VALUES (%s, 1, %s)
                   ON CONFLICT (value) DO UPDATE SET
                       occurrence_count = collatz_frequency.occurrence_count + 1,
                       updated_at = CURRENT_TIMESTAMP""",
                (val, run_id)
            )

        conn.commit()

        return jsonify({
            'run_id': run_id,
            'start_number': start_number,
            'total_steps': len(sequence) - 1,
            'max_value': max_value,
            'reached_one': reached_one,
            'sequence': sequence
        })

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/collatz/tree', methods=['POST'])
def build_tree():
    data = request.get_json()
    sequence = data.get('sequence', [])
    if not sequence:
        return jsonify({'error': 'Пустая последовательность'}), 400
    tree = _build_tree(sequence)
    return jsonify({'tree': tree})


def _build_tree(sequence):
    if not sequence:
        return None
    root = {
        'name': str(sequence[0]['value']),
        'value': sequence[0]['value'],
        'operation': sequence[0]['operation'],
        'step': sequence[0]['step'],
        'children': []
    }
    current = root
    for i in range(1, len(sequence)):
        child = {
            'name': str(sequence[i]['value']),
            'value': sequence[i]['value'],
            'operation': sequence[i]['operation'],
            'step': sequence[i]['step'],
            'children': []
        }
        current['children'].append(child)
        current = child
    return root


@app.route('/api/collatz/frequency', methods=['GET'])
def get_frequency():
    limit = request.args.get('limit', 50, type=int)
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT value, occurrence_count,
                      CASE WHEN value %% 2 = 0 THEN 'чётное' ELSE 'нечётное' END AS parity
               FROM collatz_frequency
               ORDER BY occurrence_count DESC
               LIMIT %s""",
            (limit,)
        )
        rows = cur.fetchall()
        return jsonify({'frequencies': [dict(r) for r in rows]})
    finally:
        conn.close()


@app.route('/api/collatz/runs', methods=['GET'])
def get_runs():
    limit = request.args.get('limit', 20, type=int)
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT id, start_number, total_steps, max_value, reached_one, mode,
                      created_at::text as created_at
               FROM collatz_runs
               ORDER BY created_at DESC
               LIMIT %s""",
            (limit,)
        )
        rows = cur.fetchall()
        return jsonify({'runs': [dict(r) for r in rows]})
    finally:
        conn.close()


@app.route('/api/collatz/run/<int:run_id>', methods=['GET'])
def get_run_detail(run_id):
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM collatz_runs WHERE id = %s", (run_id,))
        run = cur.fetchone()
        if not run:
            return jsonify({'error': 'Запуск не найден'}), 404
        cur.execute(
            """SELECT step_number, value, operation
               FROM collatz_steps WHERE run_id = %s
               ORDER BY step_number""",
            (run_id,)
        )
        steps = cur.fetchall()
        return jsonify({
            'run': dict(run),
            'steps': [dict(s) for s in steps]
        })
    finally:
        conn.close()


@app.route('/api/collatz/common', methods=['POST'])
def find_common():
    data = request.get_json()
    num1 = data.get('num1')
    num2 = data.get('num2')
    if not num1 or not num2:
        return jsonify({'error': 'Нужны два числа'}), 400
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM find_common_values(%s, %s)", (int(num1), int(num2)))
        common = [row[0] for row in cur.fetchall()]
        return jsonify({'common_values': common, 'count': len(common)})
    finally:
        conn.close()


@app.route('/api/collatz/db-sequence', methods=['GET'])
def db_sequence():
    number = request.args.get('number', type=int)
    max_steps = request.args.get('max_steps', 10000, type=int)
    if not number or number < 1:
        return jsonify({'error': 'Число должно быть положительным'}), 400
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM generate_collatz_sequence(%s, %s)", (number, max_steps))
        rows = cur.fetchall()
        return jsonify({
            'number': number,
            'steps': [dict(r) for r in rows],
            'total_steps': len(rows) - 1,
            'computed_by': 'PostgreSQL function'
        })
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
