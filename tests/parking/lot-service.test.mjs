import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
class Storage {
  data = new Map()
  getItem(k) { return this.data.get(k) ?? null }
  setItem(k,v) { this.data.set(k,String(v)) }
  removeItem(k) { this.data.delete(k) }
}
globalThis.localStorage = new Storage()
globalThis.sessionStorage = new Storage()
const result=await build({entryPoints:['src/api/lot-management.service.ts'],bundle:true,write:false,format:'esm',platform:'browser',alias:{'@':`${process.cwd()}/src`},define:{'import.meta.env':JSON.stringify({DEV:true,VITE_MOCK_SERVICES:'staff,parking,reports'})}})
const {lotManagementService:s}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
function login(role,userId){localStorage.setItem('pms_user',JSON.stringify({role,userId}));localStorage.setItem('pms_token','demo.test')}
test('Admin → assigned Manager → zone/slot lifecycle and access boundaries',async()=>{
 login('ADMIN','admin')
 const initial=await s.list();assert.equal(initial.length,6)
 const managers=await s.managers();assert(managers.some(m=>m.id==='usr-0001'))
 const lot=await s.saveLot({code:'TEST',name:'Test lot',address:'Thu Duc',latitude:null,longitude:null,is24Hours:true,openTime:'',closeTime:'',capacity:20,imageUrl:'',description:'',managerUserId:'usr-0001',status:'Active',closedFrom:'',closedUntil:'',closureReason:'',maintenanceNotice:''})
 assert.equal(lot.status,'Inactive','new lots start inactive')
 await assert.rejects(()=>s.saveZone(lot.id,{code:'A',name:'A',zoneType:'Area',floorNo:null,capacity:10,vehicleCapacities:{CAR_4:10},reservationLimit:2,isActive:true}),/Only the Manager/)
 login('MANAGER','usr-0002');assert(!(await s.list()).some(l=>l.id===lot.id))
 await assert.rejects(()=>s.saveZone(lot.id,{}),/assigned scope/)
 login('MANAGER','usr-0001')
 await assert.rejects(()=>s.deleteLot(lot.id),/Only an Admin/)
 const input={code:'A',name:'Khu A',zoneType:'Area',floorNo:null,capacity:10,vehicleCapacities:{CAR_4:10},reservationLimit:2,isActive:true}
 await s.saveZone(lot.id,input)
 let current=(await s.list()).find(l=>l.id===lot.id);const z=current.zones[0]
 await s.saveSlot(lot.id,z.id,{code:'A01',vehicleTypeId:'CAR_4',status:'Available'})
 await assert.rejects(()=>s.saveSlot(lot.id,z.id,{code:'A01',vehicleTypeId:'CAR_4',status:'Available'}),/already exists/)
 await assert.rejects(()=>s.deleteZone(lot.id,z.id),/without slots/)
 current=(await s.list()).find(l=>l.id===lot.id);const slot=current.zones[0].slots[0]
 await s.saveSlot(lot.id,z.id,{...slot,status:'Maintenance'},slot.id)
 await s.setOperation(lot.id,{status:'TemporarilyClosed',closedFrom:'2026-10-15T09:00',closedUntil:'2026-10-16T09:00',closureReason:'Repairs',maintenanceNotice:'Closed for one day'})
 assert.equal((await s.list()).find(l=>l.id===lot.id).status,'TemporarilyClosed')
 await s.deleteSlot(lot.id,z.id,slot.id);await s.deleteZone(lot.id,z.id)
 login('STAFF','usr-0001');await assert.rejects(()=>s.list(),/do not have permission/)
 login('ADMIN','admin');await s.deleteLot(lot.id);assert.equal((await s.list()).length,6)
 assert(localStorage.getItem('pms_lot_management_demo_v1'))
})
