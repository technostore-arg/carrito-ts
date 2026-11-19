/**
 * Test: sin APPROVAL_SECRET no se puede firmar tokens de aprobación.
 * Antes de la corrección: signApprovalToken(id, '') firma con el default 'dev-secret' (forjable).
 * Después: lanza un error explícito.
 */
import assert from 'node:assert/strict'
import { signApprovalToken, verifyApprovalToken } from '../server/agent/orderFulfillmentAgent.js'

assert.throws(() => signApprovalToken('ap-1', '', 86400000), /APPROVAL_SECRET/)
const token = signApprovalToken('ap-1', 'secret-real', 86400000)
assert.equal(verifyApprovalToken(token, 'ap-1', 'secret-real'), true)
assert.equal(verifyApprovalToken(token, 'ap-1', 'secret-otro'), false)
console.log('TEST approval-secret OK')
