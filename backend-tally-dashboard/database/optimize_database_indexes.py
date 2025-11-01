import psycopg2
import time
import statistics

conn_string = "postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

try:
    # Measure connection time
    start = time.time()
    conn = psycopg2.connect(conn_string)
    conn_time = time.time() - start
    print(f" Connection established in {conn_time:.4f} seconds\n")

    cur = conn.cursor()
    print(" Starting 10 pings using SELECT 1...")

    times = []
    for i in range(10):
        t1 = time.time()
        cur.execute("SELECT 1;")
        cur.fetchone()
        t2 = time.time()
        dt = t2 - t1
        times.append(dt)
        print(f"Ping {i+1}: {dt:.4f} s")
        time.sleep(0.1)

    print("\nPing Stats:")
    print(f"Min:  {min(times):.4f} s")
    print(f"Max:  {max(times):.4f} s")
    print(f"Avg:  {statistics.mean(times):.4f} s")

    cur.close()
    conn.close()

except Exception as e:
    print("❌ Error:", e)
