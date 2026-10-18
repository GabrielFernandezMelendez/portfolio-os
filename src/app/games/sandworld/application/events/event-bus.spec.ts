import { EventBus } from './event-bus';

interface TestEvents {
  ping: number;
  pong: string;
}

describe('EventBus', () => {
  it('entrega cada evento solo a sus suscriptores', () => {
    const bus = new EventBus<TestEvents>();
    const pings: number[] = [];
    const pongs: string[] = [];
    bus.on('ping', n => pings.push(n));
    bus.on('pong', s => pongs.push(s));
    bus.emit('ping', 1);
    bus.emit('pong', 'a');
    expect(pings).toEqual([1]);
    expect(pongs).toEqual(['a']);
  });

  it('la función devuelta da de baja al suscriptor', () => {
    const bus = new EventBus<TestEvents>();
    const pings: number[] = [];
    const off = bus.on('ping', n => pings.push(n));
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(pings).toEqual([1]);
  });
});
