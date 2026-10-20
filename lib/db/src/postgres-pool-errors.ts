type PostgresClientErrorEvents = {
  on: (event: "error", listener: (error: Error) => void) => unknown;
};

interface PostgresPoolErrorEvents {
  on(
    event: "connect",
    listener: (client: PostgresClientErrorEvents) => void,
  ): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
}

export const attachPostgresPoolErrorHandlers = (
  pool: PostgresPoolErrorEvents,
  report: (scope: "client" | "pool", error: Error) => void,
) => {
  pool.on("connect", (client) => {
    // Checked-out clients do not have pg-pool's idle-client error listener.
    // A socket loss on one of them would otherwise become an uncaught error.
    client.on("error", (error) => report("client", error));
  });

  // pg-pool emits this for idle clients it removes after a connection error.
  pool.on("error", (error) => report("pool", error));
};
