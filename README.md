# Koatest
test with:
http://localhost:3333/v1/users?user=hello
or
http://user:password@localhost:3333/v1/users?user=hello2


{
  name: "temp1"
  type: "cuve" -> nodeIdFormat = name,site,atelier
  site: "lyon"
  atelier: "at1"
  etc...
}

-> 
{ 
  id=[ name:"temp1", type:"cuve", site:"lyon") -> notation at1.atelier/... /
    -> order independante except temp1.cuve at the end (temp1=name, cuve=type)
  poll=true
  period=2s
  event=true
  protocol=modbusTCP
  protocol= {server:"plc","register":2, }
}