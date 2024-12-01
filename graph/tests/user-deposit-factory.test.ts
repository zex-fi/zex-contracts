import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Deployed } from "../generated/schema"
import { Deployed as DeployedEvent } from "../generated/UserDepositFactory/UserDepositFactory"
import { handleDeployed } from "../src/user-deposit-factory"
import { createDeployedEvent } from "./user-deposit-factory-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let addr = Address.fromString("0x0000000000000000000000000000000000000001")
    let salt = BigInt.fromI32(234)
    let newDeployedEvent = createDeployedEvent(addr, salt)
    handleDeployed(newDeployedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("Deployed created and stored", () => {
    assert.entityCount("Deployed", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "Deployed",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "addr",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "Deployed",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "salt",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
