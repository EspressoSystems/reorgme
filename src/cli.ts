#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { Reorgme, ReorgmeDefaults } from './reorgme'

export const command = yargs(hideBin(process.argv))
  .options({
    id: { type: 'number', default: ReorgmeDefaults.id },
    rpcPort: { type: 'array', help: "RPC ports for the 3 geth nodes", default: [18545, 28545, 38545] }
  })
  .command("start", "creates and starts a new testnet blockchain", (yargs) => {
    yargs.options({
      detach: { type: 'boolean', default: true },
      allocation: { type: 'array', help: "balance allocation on genesis, e.g. 0xf41c74c9ae680c1aa78f42e5647a62f353b7bdde=1000000000000000000", default: [] },
    })
  }, async (args) => {
    const allocations = (args.allocation as string[]).map((s) => {
      const parts = s.split("=")
      if (parts.length !== 2) {
        throw new Error(`invalid allocation ${s} - allocation format must follow <addr>=<balance>`)
      }
      return { addr: parts[0], balance: parts[1] }
    }).reduce((p, v) => ({ ...p, [v.addr]: { balance: v.balance }}), {})

    const reorgme = new Reorgme({ id: args.id, allocations: allocations, rpcPorts: parseRpcPorts(args) })

    let canceled = false

    process.on('SIGINT', async function() {
      canceled = true
      await reorgme.stop()
      process.exit()
    })

    try {
      await reorgme.start()

      if (!args.detach) {
        await reorgme.logs(1024)
      }
    } catch (e) {
      if (!canceled) {
        throw e
      }
    }
  })
  .command("stop", "stops and removes a testnet blockchain", () => {}, async (args) => {
    await new Reorgme({ id: args.id, rpcPorts: parseRpcPorts(args) }).stop()
  })
  .command("pause", "pauses a testnet blockchain", () => {}, async (args) => {
    await new Reorgme({ id: args.id, rpcPorts: parseRpcPorts(args) }).pause()
  })
  .command("resume", "resumes a testnet blockchain", () => {}, async (args) => {
    await new Reorgme({ id: args.id, rpcPorts: parseRpcPorts(args) }).resume()
  })
  .command("fork", "forks the node 0 of the chain", () => {}, async (args) => {
    await new Reorgme({ id: args.id, rpcPorts: parseRpcPorts(args) }).fork()
  })
  .command("join", "joins the node 0 after forking it", () => {}, async (args) => {
    await new Reorgme({ id: args.id, rpcPorts: parseRpcPorts(args) }).join()
  })
  .command("logs", "show logs for all the nodes", () => {}, async (args) => {
    await new Reorgme({ id: args.id, rpcPorts: parseRpcPorts(args) }).logs()
  })
  .command("node", "node related commands", (yargs) => yargs
    .options({
      index: { type: 'number', require: true }
    })
    .command("ip", "retrieve the ip of a node", () => {}, async (args) => {
      console.log(await new Reorgme({ id: args.id, rpcPorts: parseRpcPorts(args) }).ipOf(args.index))
    }))
  .parse()

function parseRpcPorts (args: { rpcPort: number[] }): number[] {
  const rpcPorts = args.rpcPort as number[]
  if (rpcPorts.length != 3) {
    throw new Error(`must specify exactly 3 RPC ports`)
  }
  return rpcPorts
}
