"""Development stand-in for the pod, the UNO, and the backend, so the gateway runs on a laptop with no hardware.

    uv run devsim.py            prints the two fake serial ports, then start the gateway with the env it prints
Commands (stdin, or lines appended to the file given with --control):
    flash | p 0|1 | t <C> <H> | w <0..100> | tilt 0|1 | ir <KEY>          the pod
    bang | stopwork <miles> | clear <name> | index <n> | muster <in> <out> | briefing | rest   the backend
    backend off | backend on                                                 drop or restore the backend
"""
import argparse, asyncio, json, os, sys, time, tty
from datetime import datetime

import websockets

pod_vals = {'P': 0, 'D': 0, 'S': 0, 'M': 0, 'T': 24.0, 'H': 55, 'W': 0, 'TILT': 0}
backend_ws = None
backend_server = None
backend_port = 8765
countdown_task = None


def out(tag, msg):
    print(f'{datetime.now():%H:%M:%S} {tag:7} {msg}', flush=True)


def pty_pair():
    master, slave = os.openpty()
    tty.setraw(slave)
    return master, os.ttyname(slave)


async def pod_stream(fd):
    while True:
        line = ','.join(f'{k}:{v}' for k, v in pod_vals.items())
        os.write(fd, (line + '\n').encode())
        await asyncio.sleep(0.1)


async def uno_countdown(fd, secs):
    for n in range(secs - 1, -1, -1):
        await asyncio.sleep(1)
        os.write(fd, f'COUNT:{n}\n'.encode())


async def uno_reader(fd):
    global countdown_task
    loop = asyncio.get_running_loop()
    buf = b''
    while True:
        buf += await loop.run_in_executor(None, os.read, fd, 1024)
        while b'\n' in buf:
            line, buf = buf.split(b'\n', 1)
            cmd = line.decode().strip()
            if not cmd:
                continue
            out('UNO <-', cmd)
            os.write(fd, b'OK\n')
            if cmd.startswith(('STOPWORK:', 'REST:')):
                if countdown_task:
                    countdown_task.cancel()
                countdown_task = asyncio.create_task(uno_countdown(fd, int(cmd.split(':')[1])))
            elif cmd == 'CLEAR' and countdown_task:
                countdown_task.cancel()


async def backend(ws):
    global backend_ws
    backend_ws = ws
    out('BACKEND', f'gateway connected {ws.request.path.split("?")[0]}')
    try:
        async for raw in ws:
            m = json.loads(raw)
            if m['kind'] not in ('pod', 'state', 'count') or os.environ.get('VERBOSE'):
                out('UP', raw)
    except websockets.ConnectionClosed:
        pass
    backend_ws = None
    out('BACKEND', 'gateway disconnected')


async def down(msg):
    if backend_ws:
        await backend_ws.send(json.dumps(msg))
        out('DOWN', json.dumps(msg))
    else:
        out('DOWN', f'(backend not connected) {msg}')


async def command(line, pod_fd):
    global backend_ws
    w = line.split()
    if not w:
        return
    c = w[0]
    if c == 'flash':
        os.write(pod_fd, f'FLASH:{time.time_ns() // 1000}\n'.encode())
        out('POD ->', 'FLASH')
    elif c == 'ir':
        os.write(pod_fd, f'IR:{w[1]}\n'.encode())
        out('POD ->', f'IR:{w[1]}')
    elif c in ('p', 'w', 'tilt'):
        pod_vals[{'p': 'P', 'w': 'W', 'tilt': 'TILT'}[c]] = int(w[1])
    elif c == 't':
        pod_vals['T'], pod_vals['H'] = float(w[1]), int(w[2])
    elif c == 'bang':
        await down({'cmd': 'BANG', 'ts_us': time.time_ns() // 1000})
    elif c == 'stopwork':
        await down({'cmd': 'STOPWORK', 'seconds': 1800, 'distance_m': round(float(w[1]) * 1609.34), 'source': 'sim'})
    elif c == 'clear':
        await down({'cmd': 'CLEAR', 'by': ' '.join(w[1:]) or 'J. Smith'})
    elif c == 'index':
        await down({'cmd': 'INDEX', 'value': int(w[1]), 'reason': 'Gusts 50 km/h'})
    elif c == 'muster':
        await down({'cmd': 'MUSTER', 'in': [f'crew{i}' for i in range(int(w[1]))], 'out': [f'gone{i}' for i in range(int(w[2]))]})
    elif c == 'rest':
        await down({'cmd': 'REST', 'seconds': 900})
    elif c == 'briefing':
        await down({'cmd': 'BRIEFING', 'english': 'Heat index 104 tomorrow. Take water breaks.',
                    'spanish': 'Índice de calor 104 mañana. Tomen descansos.', 'for_date': '2026-10-18'})
    elif c == 'backend':   # off stops listening, like a real outage: connections are refused, not accepted and dropped
        global backend_server
        if w[1] == 'off' and backend_server:
            backend_server.close()
            if backend_ws:
                await backend_ws.close()
            await backend_server.wait_closed()
            backend_server = None
        elif w[1] == 'on' and not backend_server:
            backend_server = await websockets.serve(backend, '127.0.0.1', backend_port)
        out('BACKEND', 'up' if backend_server else 'down')
    else:
        out('?', line)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--control', help='tail this file for commands instead of reading stdin')
    ap.add_argument('--port', type=int, default=8765)
    a = ap.parse_args()
    pod_fd, pod_path = pty_pair()
    uno_fd, uno_path = pty_pair()
    out('READY', f'POD_PORT={pod_path} UNO_PORT={uno_path} BACKEND_URL=ws://127.0.0.1:{a.port}/ws/gateway/12')
    asyncio.create_task(pod_stream(pod_fd))
    asyncio.create_task(uno_reader(uno_fd))
    global backend_server, backend_port
    backend_port = a.port
    backend_server = await websockets.serve(backend, '127.0.0.1', a.port)
    loop = asyncio.get_running_loop()
    if a.control:
        src = open(a.control, 'a+')
        src.seek(0, 2)                            # only commands appended from now on
        while True:
            line = src.readline()
            if line:
                await command(line.strip(), pod_fd)
            else:
                await asyncio.sleep(0.1)
    while line := await loop.run_in_executor(None, sys.stdin.readline):
        await command(line.strip(), pod_fd)


if __name__ == '__main__':
    asyncio.run(main())
