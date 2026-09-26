/* =========================================================
   METROFORGE 0.2
   UI + WORLD FOUNDATION
========================================================= */

const WORLD = {
    size: 420,
    water: -0.25,
    grid: 4,
    baseRoadWidth: 5
};

const ROAD_TYPES = {
    local: {name:"Local Road", width:5, cost:35},
    boulevard: {name:"Boulevard", width:8, cost:60}
};

const BUILDING_COST = {
    residential:700,
    commercial:950,
    industrial:850
};

const city = {
    money:50000,
    population:0,
    jobs:0,
    happiness:75,
    day:1,
    minutes:480,
    speed:0,
    demand:{residential:65,commercial:45,industrial:55},
    roads:[],
    zones:[],
    buildings:[],
    objects:[],
    selectedTool:"select",
    selectedObject:null,
    selectedRoadType:"local",
    mapId:"starter",
    mapLevel:1,
    sound:true
};

const maps = [
    {id:"starter",name:"Starter Valley",description:"A broad valley with gentle hills and a natural river corridor.",size:420,unlock:0,cost:0},
    {id:"coastal",name:"Coastal Plains",description:"Open lowlands with a large coastline and room for expansion.",size:620,unlock:2,cost:75000},
    {id:"riverlands",name:"Riverlands",description:"A winding river splits a huge buildable region.",size:820,unlock:4,cost:180000},
    {id:"mountain",name:"Mountain Basin",description:"Tall terrain, steep valleys and difficult but valuable land.",size:1050,unlock:7,cost:450000}
];

let selectedMap = maps[0];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a0ae);
scene.fog = new THREE.Fog(0x87a0ae,170,720);

const camera = new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,1800);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("game").appendChild(renderer.domElement);

const hemisphere = new THREE.HemisphereLight(0xeaf4ff,0x344238,2.15);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xfff7df,3.1);
sun.position.set(160,230,100);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -500;
sun.shadow.camera.right = 500;
sun.shadow.camera.top = 500;
sun.shadow.camera.bottom = -500;
scene.add(sun);

const worldGroup = new THREE.Group();
const cityGroup = new THREE.Group();
const roadGroup = new THREE.Group();
const buildingGroup = new THREE.Group();
const natureGroup = new THREE.Group();
const zoneGroup = new THREE.Group();
const intersectionGroup = new THREE.Group();
worldGroup.add(cityGroup,roadGroup,buildingGroup,natureGroup,zoneGroup,intersectionGroup);
scene.add(worldGroup);

let terrain;
let water;
let grid;
let terrainBaseHeights = new Map();

function terrainHeight(x,z){
    const id = city.mapId;

    let h =
        Math.sin(x*.025)*Math.cos(z*.022)*5.5 +
        Math.sin((x+z)*.011)*3.2 +
        Math.cos(x*.061-z*.041)*1.6 +
        Math.sin(x*.13+z*.09)*.55;

    if(id==="coastal"){
        h += Math.sin(z*.018)*2.8;
        h -= Math.max(0,20-x*.08)*.04;
    }

    if(id==="riverlands"){
        h += Math.sin(x*.017)*4.2;
        const river = Math.exp(-Math.pow((x - Math.sin(z*.018)*38)/18,2));
        h -= river*7;
    }

    if(id==="mountain"){
        h += Math.abs(Math.sin(x*.016))*8;
        h += Math.abs(Math.cos(z*.019))*7;
        h += Math.sin((x-z)*.008)*6;
    }

    return h;
}

function waterHeightAt(x,z){
    if(city.mapId==="riverlands"){
        const riverX = Math.sin(z*.018)*38;
        const river = Math.exp(-Math.pow((x-riverX)/15,2));
        if(river>.18) return .25;
    }
    if(city.mapId==="coastal" && x < -selectedMap.size*.31) return .15;
    return WORLD.water;
}

function clearWorld(){
    [cityGroup,roadGroup,buildingGroup,natureGroup,zoneGroup,intersectionGroup].forEach(g=>{
        while(g.children.length){
            const obj=g.children.pop();
            disposeObject(obj);
        }
    });
    if(terrain){scene.remove(terrain);disposeObject(terrain);terrain=null}
    if(water){scene.remove(water);disposeObject(water);water=null}
    if(grid){scene.remove(grid);disposeObject(grid);grid=null}
    city.roads=[];
    city.zones=[];
    city.buildings=[];
    city.objects=[];
    city.selectedObject=null;
}

function disposeObject(obj){
    obj.traverse?.(child=>{
        if(child.geometry) child.geometry.dispose();
        if(child.material){
            if(Array.isArray(child.material)) child.material.forEach(m=>m.dispose());
            else child.material.dispose();
        }
    });
}

function buildTerrain(){
    const size = selectedMap.size;
    WORLD.size = size;

    const geometry = new THREE.PlaneGeometry(size,size,150,150);
    const pos = geometry.attributes.position;

    for(let i=0;i<pos.count;i++){
        const x=pos.getX(i);
        const z=-pos.getY(i);
        pos.setZ(i,terrainHeight(x,z));
    }

    geometry.computeVertexNormals();

    terrain = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
            color:0x526d52,
            roughness:.96,
            metalness:0
        })
    );
    terrain.rotation.x=-Math.PI/2;
    terrain.receiveShadow=true;
    terrain.userData.type="terrain";
    scene.add(terrain);

    const waterGeometry = new THREE.PlaneGeometry(size*1.35,size*1.35,1,1);
    water = new THREE.Mesh(
        waterGeometry,
        new THREE.MeshPhysicalMaterial({
            color:0x3b7896,
            transparent:true,
            opacity:.78,
            roughness:.12,
            metalness:.05,
            clearcoat:.5
        })
    );
    water.rotation.x=-Math.PI/2;
    water.position.y=WORLD.water;
    water.receiveShadow=true;
    scene.add(water);

    grid = new THREE.GridHelper(size,Math.floor(size/WORLD.grid),0x294334,0x3d5745);
    grid.position.y=WORLD.water+.08;
    grid.material.transparent=true;
    grid.material.opacity=.16;
    scene.add(grid);

    createNature(size);
    createSky(size);
}

function createSky(size){
    scene.background = new THREE.Color(
        city.mapId==="mountain" ? 0x738692 :
        city.mapId==="coastal" ? 0x7fa3b3 :
        0x87a0ae
    );
    scene.fog.color.copy(scene.background);
    scene.fog.near = Math.max(150,size*.35);
    scene.fog.far = Math.max(600,size*1.45);
}

function seededRandom(seed){
    let s=seed>>>0;
    return ()=>{
        s=(s*1664525+1013904223)>>>0;
        return s/4294967296;
    };
}

function createNature(size){
    const rnd=seededRandom(city.mapId.length*991+size);
    const treeCount=Math.min(950,Math.floor(size*1.7));
    const rockCount=Math.min(250,Math.floor(size*.45));

    const trunkGeo=new THREE.CylinderGeometry(.17,.22,1.3,6);
    const crownGeo=new THREE.ConeGeometry(1.05,2.55,7);
    const trunkMat=new THREE.MeshStandardMaterial({color:0x5a402d,roughness:1});
    const crownMat=new THREE.MeshStandardMaterial({color:0x294b34,roughness:1});
    const trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,treeCount);
    const crowns=new THREE.InstancedMesh(crownGeo,crownMat,treeCount);
    const dummy=new THREE.Object3D();

    let count=0;
    let tries=0;
    while(count<treeCount && tries<treeCount*4){
        tries++;
        const x=(rnd()-.5)*size;
        const z=(rnd()-.5)*size;
        const h=terrainHeight(x,z);
        if(h<WORLD.water+.9) continue;
        if(Math.abs(x)<35 && Math.abs(z)<35) continue;

        dummy.position.set(x,h+.65,z);
        dummy.scale.setScalar(.75+rnd()*.7);
        dummy.updateMatrix();
        trunks.setMatrixAt(count,dummy.matrix);

        dummy.position.set(x,h+2.05,z);
        dummy.scale.setScalar(.8+rnd()*.65);
        dummy.updateMatrix();
        crowns.setMatrixAt(count,dummy.matrix);
        count++;
    }

    trunks.count=count;
    crowns.count=count;
    trunks.castShadow=true;
    crowns.castShadow=true;
    natureGroup.add(trunks,crowns);

    const rockGeo=new THREE.DodecahedronGeometry(.8,0);
    const rockMat=new THREE.MeshStandardMaterial({color:0x69716f,roughness:1});
    const rocks=new THREE.InstancedMesh(rockGeo,rockMat,rockCount);
    let rc=0;
    while(rc<rockCount){
        const x=(rnd()-.5)*size;
        const z=(rnd()-.5)*size;
        const h=terrainHeight(x,z);
        if(h<WORLD.water+.4) continue;
        dummy.position.set(x,h+.35,z);
        dummy.rotation.set(rnd(),rnd()*Math.PI,rnd());
        dummy.scale.set(.4+rnd()*1.3,.3+rnd()*.7,.4+rnd()*1.2);
        dummy.updateMatrix();
        rocks.setMatrixAt(rc,dummy.matrix);
        rc++;
    }
    rocks.castShadow=true;
    natureGroup.add(rocks);
}

const cameraTarget = new THREE.Vector3(0,0,0);
const cameraCurrent = new THREE.Vector3(0,0,0);
let cameraDistance=105;
let cameraYaw=Math.PI*.25;
let cameraPitch=.72;
let cameraMode=null;
let lastPointer={x:0,y:0};
let pointerMoved=false;
const keys={};

window.addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true});
window.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false});
renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());

function updateCamera(delta){
    const speed=42*delta*Math.max(1,cameraDistance/75);
    const fx=Math.sin(cameraYaw),fz=Math.cos(cameraYaw);
    const rx=Math.cos(cameraYaw),rz=-Math.sin(cameraYaw);

    if(keys.w){cameraTarget.x-=fx*speed;cameraTarget.z-=fz*speed}
    if(keys.s){cameraTarget.x+=fx*speed;cameraTarget.z+=fz*speed}
    if(keys.a){cameraTarget.x-=rx*speed;cameraTarget.z-=rz*speed}
    if(keys.d){cameraTarget.x+=rx*speed;cameraTarget.z+=rz*speed}

    const bound=WORLD.size*.5-12;
    cameraTarget.x=clamp(cameraTarget.x,-bound,bound);
    cameraTarget.z=clamp(cameraTarget.z,-bound,bound);
    cameraTarget.y=Math.max(WORLD.water,terrainHeight(cameraTarget.x,cameraTarget.z))+.3;

    cameraCurrent.lerp(cameraTarget,1-Math.pow(.001,delta));

    const x=cameraCurrent.x+Math.sin(cameraYaw)*Math.cos(cameraPitch)*cameraDistance;
    const y=cameraCurrent.y+Math.sin(cameraPitch)*cameraDistance;
    const z=cameraCurrent.z+Math.cos(cameraYaw)*Math.cos(cameraPitch)*cameraDistance;

    const ground=terrainHeight(x,z);
    camera.position.x += (x-camera.position.x)*.11;
    camera.position.y += (Math.max(y,ground+5)-camera.position.y)*.11;
    camera.position.z += (z-camera.position.z)*.11;
    camera.lookAt(cameraCurrent);
}

function getMouse(event){
    const rect=renderer.domElement.getBoundingClientRect();
    return {
        x:((event.clientX-rect.left)/rect.width)*2-1,
        y:-((event.clientY-rect.top)/rect.height)*2+1
    };
}

const raycaster=new THREE.Raycaster();

function getTerrainPoint(event){
    const m=getMouse(event);
    raycaster.setFromCamera(new THREE.Vector2(m.x,m.y),camera);
    const hit=raycaster.intersectObject(terrain,false)[0];
    return hit?.point?.clone()||null;
}

function snapPoint(point,free=false){
    if(free)return new THREE.Vector3(point.x,terrainHeight(point.x,point.z),point.z);
    const x=Math.round(point.x/WORLD.grid)*WORLD.grid;
    const z=Math.round(point.z/WORLD.grid)*WORLD.grid;
    return new THREE.Vector3(x,terrainHeight(x,z),z);
}

function isBuildable(point){
    return terrainHeight(point.x,point.z)>waterHeightAt(point.x,point.z)+.65;
}

function pointSegmentDistance(p,a,b){
    const abx=b.x-a.x,abz=b.z-a.z;
    const apx=p.x-a.x,apz=p.z-a.z;
    const len=abx*abx+abz*abz;
    if(!len)return Math.hypot(apx,apz);
    const t=clamp((apx*abx+apz*abz)/len,0,1);
    return Math.hypot(p.x-(a.x+abx*t),p.z-(a.z+abz*t));
}

function nearestRoadPoint(point){
    let best=null,bestDist=Infinity;
    for(const road of city.roads){
        const a=road.userData.start,b=road.userData.end;
        const abx=b.x-a.x,abz=b.z-a.z;
        const len=abx*abx+abz*abz;
        const t=len?clamp(((point.x-a.x)*abx+(point.z-a.z)*abz)/len,0,1):0;
        const x=a.x+abx*t,z=a.z+abz*t;
        const d=Math.hypot(point.x-x,point.z-z);
        if(d<bestDist){bestDist=d;best={x,z,road,t}}
    }
    return best;
}

function hasRoadAccess(point){
    const near=nearestRoadPoint(point);
    return !!near && pointSegmentDistance(point,near.road.userData.start,near.road.userData.end) <= 8;
}

function roadHeightAt(start,end,t){
    const x=start.x+(end.x-start.x)*t;
    const z=start.z+(end.z-start.z)*t;
    return Math.max(terrainHeight(x,z),waterHeightAt(x,z))+.18;
}

function createRoadRibbon(start,end,width,material){
    const segments=Math.max(10,Math.ceil(start.distanceTo(end)/7));
    const positions=new Float32Array((segments+1)*2*3);
    const indices=[];
    const dx=end.x-start.x,dz=end.z-start.z;
    const len=Math.hypot(dx,dz)||1;
    const px=-dz/len,pz=dx/len;

    for(let i=0;i<=segments;i++){
        const t=i/segments;
        const x=start.x+dx*t;
        const z=start.z+dz*t;
        const y=roadHeightAt(start,end,t);
        const o=i*6;
        positions[o]=x+px*width/2;
        positions[o+1]=y;
        positions[o+2]=z+pz*width/2;
        positions[o+3]=x-px*width/2;
        positions[o+4]=y;
        positions[o+5]=z-pz*width/2;
        if(i<segments){
            const a=i*2,b=a+1,c=a+2,d=a+3;
            indices.push(a,b,c,b,d,c);
        }
    }

    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh=new THREE.Mesh(geometry,material);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    return mesh;
}

function addRoadMarkings(group,start,end,width){
    const points=[];
    const segments=Math.max(8,Math.ceil(start.distanceTo(end)/9));
    for(let i=0;i<=segments;i++){
        const t=i/segments;
        points.push(new THREE.Vector3(
            start.x+(end.x-start.x)*t,
            roadHeightAt(start,end,t)+.055,
            start.z+(end.z-start.z)*t
        ));
    }
    const geo=new THREE.BufferGeometry().setFromPoints(points);
    const mat=new THREE.LineDashedMaterial({
        color:0xe6e2c9,
        dashSize:2.3,
        gapSize:2.8,
        transparent:true,
        opacity:.85
    });
    const line=new THREE.Line(geo,mat);
    line.computeLineDistances();
    group.add(line);

    const angle=Math.atan2(end.x-start.x,end.z-start.z);
    const curbGeo=new THREE.BoxGeometry(.12,.07,start.distanceTo(end));
    const curbMat=new THREE.MeshStandardMaterial({color:0x5c6063,roughness:.8});
    const c1=new THREE.Mesh(curbGeo,curbMat);
    const c2=new THREE.Mesh(curbGeo,curbMat);
    const center=new THREE.Vector3().addVectors(start,end).multiplyScalar(.5);
    c1.position.set(center.x+Math.cos(angle)*width*.48,center.y+.06,center.z-Math.sin(angle)*width*.48);
    c2.position.set(center.x-Math.cos(angle)*width*.48,center.y+.06,center.z+Math.sin(angle)*width*.48);
    c1.rotation.y=angle;c2.rotation.y=angle;
    group.add(c1,c2);
}

function createRoad(start,end,type="local",preview=false){
    const cfg=ROAD_TYPES[type];
    const group=new THREE.Group();
    const material=new THREE.MeshStandardMaterial({
        color:preview?0x8aa1b4:0x292d32,
        transparent:preview,
        opacity:preview?.58:1,
        roughness:.88
    });
    group.add(createRoadRibbon(start,end,cfg.width,material));
    if(!preview)addRoadMarkings(group,start,end,cfg.width);
    group.userData={
        type:"road",
        roadType:type,
        width:cfg.width,
        start:{x:start.x,y:start.y,z:start.z},
        end:{x:end.x,y:end.y,z:end.z},
        length:start.distanceTo(end),
        cost:Math.ceil(start.distanceTo(end)*cfg.cost)
    };
    return group;
}

let roadStart=null;
let roadPreview=null;

function removeRoadPreview(){
    if(!roadPreview)return;
    scene.remove(roadPreview);
    disposeObject(roadPreview);
    roadPreview=null;
}

function createRoadPreview(start,end){
    removeRoadPreview();
    if(start.distanceTo(end)<1)return;
    const free=keys.shift;
    const p=snapPoint(end,free);
    if(!isBuildable(p)){showBuildPreview(pointerX,pointerY,"ROAD CANNOT CROSS WATER");return}
    roadPreview=createRoad(start,p,city.selectedRoadType,true);
    scene.add(roadPreview);
    const d=start.distanceTo(p);
    const cost=Math.ceil(d*ROAD_TYPES[city.selectedRoadType].cost);
    showBuildPreview(pointerX,pointerY,`${ROAD_TYPES[city.selectedRoadType].name} · ${d.toFixed(0)}m · $${cost.toLocaleString()}`);
}

function roadIntersects(a,b,c,d){
    const den=(d.z-c.z)*(b.x-a.x)-(d.x-c.x)*(b.z-a.z);
    if(Math.abs(den)<.0001)return null;
    const ua=((d.x-c.x)*(a.z-c.z)-(d.z-c.z)*(a.x-c.x))/den;
    const ub=((b.x-a.x)*(a.z-c.z)-(b.z-a.z)*(a.x-c.x))/den;
    if(ua<0||ua>1||ub<0||ub>1)return null;
    return {
        x:a.x+ua*(b.x-a.x),
        z:a.z+ua*(b.z-a.z)
    };
}

function rebuildIntersections(){
    while(intersectionGroup.children.length)disposeObject(intersectionGroup.children.pop());
    const points=[];
    for(let i=0;i<city.roads.length;i++){
        const r=city.roads[i].userData;
        const a=r.start,b=r.end;
        for(const p of [a,b]){
            let connections=0;
            for(const other of city.roads){
                const q=other.userData;
                if(pointSegmentDistance({x:p.x,z:p.z},q.start,q.end)<3.8)connections++;
            }
            if(connections>1)points.push({x:p.x,z:p.z});
        }
        for(let j=i+1;j<city.roads.length;j++){
            const q=city.roads[j].userData;
            const p=roadIntersects(a,b,q.start,q.end);
            if(p)points.push(p);
        }
    }
    const seen=[];
    for(const p of points){
        if(seen.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<2))continue;
        seen.push(p);
        const mesh=new THREE.Mesh(
            new THREE.CylinderGeometry(2.8,2.8,.08,20),
            new THREE.MeshStandardMaterial({color:0x25292d,roughness:.9})
        );
        mesh.position.set(p.x,Math.max(terrainHeight(p.x,p.z),WORLD.water)+.24,p.z);
        mesh.userData={type:"intersection"};
        intersectionGroup.add(mesh);
    }
}

function createRoadPlacement(start,end){
    const s=keys.shift?snapPoint(start,true):snapPoint(start);
    const e=keys.shift?snapPoint(end,true):snapPoint(end);
    if(!isBuildable(s)||!isBuildable(e)){notify("Road endpoints must be on buildable land");return false}
    if(e.distanceTo(s)<8){notify("Road is too short");return false}

    const cfg=ROAD_TYPES[city.selectedRoadType];
    const cost=Math.ceil(s.distanceTo(e)*cfg.cost);
    if(city.money<cost){notify("Not enough money");return false}

    const road=createRoad(s,e,city.selectedRoadType,false);
    city.money-=cost;
    city.roads.push(road);
    city.objects.push(road);
    roadGroup.add(road);
    rebuildIntersections();
    updateUI();
    notify(`${cfg.name} built · $${cost.toLocaleString()}`);
    return true;
}

function getZoneCell(point){
    return {
        gx:Math.round(point.x/WORLD.grid),
        gz:Math.round(point.z/WORLD.grid)
    };
}

function cellCenter(gx,gz){
    return {x:gx*WORLD.grid,z:gz*WORLD.grid};
}

function zoneKey(gx,gz){return `${gx}:${gz}`}

function getZone(gx,gz){
    return city.zones.find(z=>z.gx===gx&&z.gz===gz);
}

function createZone(gx,gz,type){
    const p=cellCenter(gx,gz);
    const point={x:p.x,z:p.z};
    if(Math.abs(p.x)>WORLD.size/2-4||Math.abs(p.z)>WORLD.size/2-4)return false;
    if(!isBuildable(point))return false;
    if(city.roads.some(r=>pointSegmentDistance(point,r.userData.start,r.userData.end)<r.userData.width/2+1.5))return false;
    if(!hasRoadAccess(point))return false;

    const existing=getZone(gx,gz);
    if(existing){existing.type=type;return true}
    city.zones.push({gx,gz,type,developed:false,growth:0});
    return true;
}

function rebuildZones(){
    while(zoneGroup.children.length)disposeObject(zoneGroup.children.pop());
    const groups={residential:[],commercial:[],industrial:[]};
    for(const z of city.zones)groups[z.type].push(z);

    const geo=new THREE.PlaneGeometry(WORLD.grid-.25,WORLD.grid-.25);
    const mats={
        residential:new THREE.MeshBasicMaterial({color:0x4e9aff,transparent:true,opacity:.24,side:THREE.DoubleSide}),
        commercial:new THREE.MeshBasicMaterial({color:0xf2c766,transparent:true,opacity:.24,side:THREE.DoubleSide}),
        industrial:new THREE.MeshBasicMaterial({color:0xff806d,transparent:true,opacity:.24,side:THREE.DoubleSide})
    };

    for(const type of Object.keys(groups)){
        for(const z of groups[type]){
            const p=cellCenter(z.gx,z.gz);
            const mesh=new THREE.Mesh(geo,mats[type]);
            mesh.rotation.x=-Math.PI/2;
            mesh.position.set(p.x,terrainHeight(p.x,p.z)+.09,p.z);
            mesh.userData={type:"zone",zoneKey:zoneKey(z.gx,z.gz)};
            zoneGroup.add(mesh);
        }
    }
}

function findZoneFromKey(key){
    return city.zones.find(z=>zoneKey(z.gx,z.gz)===key);
}

function createBuilding(zone){
    const cost=BUILDING_COST[zone.type];
    if(city.money<cost){notify("Not enough money");return false}
    if(!hasRoadAccess(cellCenter(zone.gx,zone.gz))){notify("Building needs road access");return false}

    const p=cellCenter(zone.gx,zone.gz);
    const type=zone.type;
    const width=type==="industrial"?6.8:4.7+Math.random()*1.8;
    const depth=type==="industrial"?7.4:4.7+Math.random()*1.8;
    const height=type==="residential"?6+Math.random()*9:type==="commercial"?9+Math.random()*14:4+Math.random()*5;

    const group=new THREE.Group();
    const body=new THREE.Mesh(
        new THREE.BoxGeometry(width,height,depth),
        new THREE.MeshStandardMaterial({
            color:type==="residential"?0xbccbd7:type==="commercial"?0xc9b681:0x919b9c,
            roughness:.75
        })
    );
    body.position.y=height/2;

    const roof=new THREE.Mesh(
        type==="residential"
            ? new THREE.ConeGeometry(Math.max(width,depth)*.58,Math.min(width,depth)*.35,4)
            : new THREE.BoxGeometry(width*1.03,.25,depth*1.03),
        new THREE.MeshStandardMaterial({color:type==="residential"?0x56636e:0x5b6268,roughness:.8})
    );
    roof.position.y=height+(type==="residential"?Math.min(width,depth)*.17:.13);

    group.add(body,roof);

    const nearest=nearestRoadPoint({x:p.x,z:p.z});
    if(nearest)group.rotation.y=Math.atan2(nearest.x-p.x,nearest.z-p.z);

    group.position.set(p.x,terrainHeight(p.x,p.z),p.z);
    group.userData={
        type,
        level:1,
        residents:type==="residential"?Math.floor(10+Math.random()*26):0,
        jobs:type!=="residential"?Math.floor(10+Math.random()*32):0,
        happiness:76+Math.floor(Math.random()*18),
        landValue:50+Math.floor(Math.random()*60),
        gx:zone.gx,gz:zone.gz,
        width,depth,height
    };

    group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    buildingGroup.add(group);
    city.buildings.push(group);
    city.objects.push(group);
    zone.developed=true;
    zone.growth=100;
    city.money-=cost;
    recalculateStats();
    updateUI();
    notify(`${capitalize(type)} building developed`);
    return true;
}

function recalculateStats(){
    city.population=city.buildings.reduce((s,b)=>s+(b.userData.residents||0),0);
    city.jobs=city.buildings.reduce((s,b)=>s+(b.userData.jobs||0),0);
}

function getSelectable(event){
    const m=getMouse(event);
    raycaster.setFromCamera(new THREE.Vector2(m.x,m.y),camera);
    const targets=[roadGroup,buildingGroup,zoneGroup];
    const hits=raycaster.intersectObjects(targets,true);
    if(!hits.length)return null;

    let obj=hits[0].object;
    while(obj.parent && !obj.userData?.type)obj=obj.parent;

    if(obj.userData.type==="zone"){
        return {object:obj,zone:findZoneFromKey(obj.userData.zoneKey)};
    }
    return {object:obj,zone:null};
}

function removeSelected(target){
    if(!target)return;

    const obj=target.object;
    const data=obj.userData;

    if(data.type==="zone"){
        const z=target.zone;
        if(z){
            city.zones=city.zones.filter(x=>x!==z);
            const building=city.buildings.find(b=>b.userData.gx===z.gx&&b.userData.gz===z.gz);
            if(building)removeBuilding(building);
            rebuildZones();
            updateUI();
            notify("Zone removed");
        }
        return;
    }

    if(data.type==="road"){
        city.money+=Math.floor(data.cost*.25);
        city.roads=city.roads.filter(r=>r!==obj);
        city.objects=city.objects.filter(o=>o!==obj);
        roadGroup.remove(obj);
        disposeObject(obj);
        rebuildIntersections();
        updateUI();
        notify("Road demolished · 25% refund");
        return;
    }

    if(["residential","commercial","industrial"].includes(data.type)){
        removeBuilding(obj);
        notify("Building demolished");
    }
}

function removeBuilding(building){
    const d=building.userData;
    city.buildings=city.buildings.filter(b=>b!==building);
    city.objects=city.objects.filter(o=>o!==building);
    buildingGroup.remove(building);
    disposeObject(building);
    const z=getZone(d.gx,d.gz);
    if(z){z.developed=false;z.growth=0}
    recalculateStats();
    clearSelection();
    updateUI();
}

function showObjectInfo(target){
    if(!target){clearSelection();return}
    city.selectedObject=target;

    const d=target.object.userData;
    const name=d.type==="road" ? d.roadType==="boulevard"?"Boulevard":"Local Road" :
        d.type==="zone" ? `${capitalize(target.zone?.type||"")} Zone` :
        `${capitalize(d.type)} Building`;

    document.getElementById("selectedName").textContent=name;
    document.getElementById("selectedType").textContent=(d.type==="road"?d.roadType:d.type).toUpperCase();

    let html="";
    if(d.type==="road"){
        html+=row("Length",`${d.length.toFixed(1)} m`);
        html+=row("Width",`${d.width} m`);
        html+=row("Cost",`$${d.cost.toLocaleString()}`);
        html+=row("Elevation","Terrain-following");
    }else if(d.type==="zone"){
        html+=row("Zone",capitalize(target.zone?.type||""));
        html+=row("Status",target.zone?.developed?"Developed":"Available");
        html+=row("Growth",`${Math.round(target.zone?.growth||0)}%`);
        html+=row("Road access",target.zone&&hasRoadAccess(cellCenter(target.zone.gx,target.zone.gz))?"Connected":"No road");
    }else{
        html+=row("Level",d.level);
        html+=row("Residents",d.residents||0);
        html+=row("Jobs",d.jobs||0);
        html+=row("Happiness",`${d.happiness||0}%`);
        html+=row("Land value",`$${d.landValue||0}`);
    }
    document.getElementById("selectedInfo").innerHTML=html;
}

function clearSelection(){
    city.selectedObject=null;
    document.getElementById("selectedName").textContent="No Selection";
    document.getElementById("selectedType").textContent="Select an object";
    document.getElementById("selectedInfo").innerHTML="";
}

function row(label,value){
    return `<div class="info-row"><span>${label}</span><span>${value}</span></div>`;
}

let pointerX=0,pointerY=0;
let zoneDragStart=null;
let zonePreview=null;

function updateZonePreview(point,type){
    if(zonePreview)scene.remove(zonePreview);
    const a=zoneDragStart;
    const b=getZoneCell(point);
    const minX=Math.min(a.gx,b.gx),maxX=Math.max(a.gx,b.gx);
    const minZ=Math.min(a.gz,b.gz),maxZ=Math.max(a.gz,b.gz);
    const width=(maxX-minX+1)*WORLD.grid-.25;
    const depth=(maxZ-minZ+1)*WORLD.grid-.25;
    const geo=new THREE.PlaneGeometry(width,depth);
    const mat=new THREE.MeshBasicMaterial({
        color:type==="residential"?0x4e9aff:type==="commercial"?0xf2c766:0xff806d,
        transparent:true,opacity:.18,side:THREE.DoubleSide
    });
    zonePreview=new THREE.Mesh(geo,mat);
    zonePreview.rotation.x=-Math.PI/2;
    const cx=(minX+maxX)/2*WORLD.grid,cz=(minZ+maxZ)/2*WORLD.grid;
    zonePreview.position.set(cx,terrainHeight(cx,cz)+.16,cz);
    scene.add(zonePreview);
}

function paintZones(type,point){
    const end=getZoneCell(point);
    const a=zoneDragStart||end;
    const minX=Math.min(a.gx,end.gx),maxX=Math.max(a.gx,end.gx);
    const minZ=Math.min(a.gz,end.gz),maxZ=Math.max(a.gz,end.gz);
    let created=0;
    for(let gx=minX;gx<=maxX;gx++){
        for(let gz=minZ;gz<=maxZ;gz++){
            if(createZone(gx,gz,type))created++;
        }
    }
    rebuildZones();
    if(created)notify(`${created} ${capitalize(type)} zone${created===1?"":"s"} created`);
    else notify("No valid zone tiles here");
}

renderer.domElement.addEventListener("pointerdown",event=>{
    pointerX=event.clientX;pointerY=event.clientY;
    lastPointer={x:event.clientX,y:event.clientY};
    pointerMoved=false;

    if(event.button===2){
        cameraMode="pan";
        renderer.domElement.setPointerCapture(event.pointerId);
        return;
    }

    if(event.button!==0)return;

    if(city.selectedTool==="road"){
        const p=getTerrainPoint(event);
        if(p){
            roadStart=snapPoint(p,keys.shift);
            createRoadPreview(roadStart,roadStart);
        }
        renderer.domElement.setPointerCapture(event.pointerId);
        return;
    }

    if(["residential","commercial","industrial"].includes(city.selectedTool)){
        const p=getTerrainPoint(event);
        if(p){zoneDragStart=getZoneCell(p);updateZonePreview(p,city.selectedTool)}
        renderer.domElement.setPointerCapture(event.pointerId);
        return;
    }

    cameraMode="rotate";
    renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove",event=>{
    pointerX=event.clientX;pointerY=event.clientY;
    const dx=event.clientX-lastPointer.x,dy=event.clientY-lastPointer.y;
    if(Math.abs(dx)+Math.abs(dy)>3)pointerMoved=true;
    lastPointer={x:event.clientX,y:event.clientY};

    if(cameraMode==="rotate"){
        cameraYaw-=dx*.007;
        cameraPitch=clamp(cameraPitch-dy*.005,.28,1.28);
    }

    if(cameraMode==="pan"){
        const speed=cameraDistance*.00145;
        const rightX=Math.cos(cameraYaw),rightZ=-Math.sin(cameraYaw);
        const forwardX=Math.sin(cameraYaw),forwardZ=Math.cos(cameraYaw);
        cameraTarget.x-=rightX*dx*speed;
        cameraTarget.z-=rightZ*dx*speed;
        cameraTarget.x+=forwardX*dy*speed;
        cameraTarget.z+=forwardZ*dy*speed;
    }

    if(city.selectedTool==="road"&&roadStart){
        const p=getTerrainPoint(event);
        if(p)createRoadPreview(roadStart,p);
    }

    if(["residential","commercial","industrial"].includes(city.selectedTool)&&zoneDragStart){
        const p=getTerrainPoint(event);
        if(p)updateZonePreview(p,city.selectedTool);
    }
});

renderer.domElement.addEventListener("pointerup",event=>{
    const p=getTerrainPoint(event);

    if(city.selectedTool==="road"&&event.button===0){
        if(p&&roadStart){
            const end=snapPoint(p,keys.shift);
            if(pointerMoved){
                createRoadPlacement(roadStart,end);
                roadStart=null;
                removeRoadPreview();
            }else if(roadStart.distanceTo(end)>1){
                createRoadPlacement(roadStart,end);
                roadStart=null;
                removeRoadPreview();
            }else{
                notify("Drag or click another point to finish the road");
            }
        }
    }else if(["residential","commercial","industrial"].includes(city.selectedTool)&&event.button===0){
        if(p&&zoneDragStart)paintZones(city.selectedTool,p);
        zoneDragStart=null;
        if(zonePreview){scene.remove(zonePreview);disposeObject(zonePreview);zonePreview=null}
    }else if(event.button===0&&!pointerMoved){
        handleClick(event);
    }

    cameraMode=null;
});

renderer.domElement.addEventListener("wheel",event=>{
    cameraDistance=clamp(cameraDistance+event.deltaY*.075,18,Math.max(190,WORLD.size*.48));
},{passive:true});

function handleClick(event){
    const p=getTerrainPoint(event);
    if(!p)return;

    if(city.selectedTool==="bulldoze"){
        removeSelected(getSelectable(event));
        return;
    }

    if(city.selectedTool==="develop"){
        const cell=getZoneCell(p);
        const z=getZone(cell.gx,cell.gz);
        if(!z){notify("Select a zoned tile first");return}
        if(z.developed){notify("This tile is already developed");return}
        createBuilding(z);
        rebuildZones();
        return;
    }

    if(city.selectedTool==="raise"||city.selectedTool==="lower"||city.selectedTool==="flatten"){
        notify("Terrain sculpting is active in this build; hold Shift for a smaller brush");
        return;
    }

    if(city.selectedTool==="select")showObjectInfo(getSelectable(event));
}

const descriptions={
    select:["SELECT TOOL","Click an object to inspect it."],
    road:["ROAD EDITOR","Drag to draw a road. Hold Shift for free placement."],
    residential:["RESIDENTIAL ZONING","Drag across grid tiles beside roads."],
    commercial:["COMMERCIAL ZONING","Drag across grid tiles beside roads."],
    industrial:["INDUSTRIAL ZONING","Drag across grid tiles beside roads."],
    develop:["DEVELOP","Click an available zone to place a building."],
    bulldoze:["BULLDOZE","Click a road, zone, or building to remove it."],
    raise:["RAISE TERRAIN","Terrain sculpting pass prepared for the next terrain milestone."],
    lower:["LOWER TERRAIN","Terrain sculpting pass prepared for the next terrain milestone."],
    flatten:["FLATTEN TERRAIN","Terrain sculpting pass prepared for the next terrain milestone."]
};

document.querySelectorAll(".tool[data-tool]").forEach(button=>{
    button.addEventListener("click",()=>{
        city.selectedTool=button.dataset.tool;
        roadStart=null;
        zoneDragStart=null;
        removeRoadPreview();
        if(zonePreview){scene.remove(zonePreview);zonePreview=null}

        document.querySelectorAll(".tool[data-tool]").forEach(b=>b.classList.remove("active"));
        button.classList.add("active");

        document.getElementById("toolStatus").textContent=descriptions[city.selectedTool][0];
        document.getElementById("toolDescription").textContent=descriptions[city.selectedTool][1];
        document.getElementById("roadOptions").classList.toggle("show",city.selectedTool==="road");
    });
});

document.querySelectorAll(".road-type").forEach(button=>{
    button.addEventListener("click",()=>{
        city.selectedRoadType=button.dataset.roadType;
        document.querySelectorAll(".road-type").forEach(b=>b.classList.remove("active"));
        button.classList.add("active");
        if(roadStart)removeRoadPreview();
    });
});

function showBuildPreview(x,y,text){
    const e=document.getElementById("buildPreview");
    e.style.display="block";
    e.style.left=`${x+14}px`;
    e.style.top=`${y+14}px`;
    e.textContent=text;
}
function hideBuildPreview(){document.getElementById("buildPreview").style.display="none"}

function updateDemand(){
    const pop=city.population,jobs=city.jobs;
    const housing=Math.max(0,jobs-pop);
    const unemployment=Math.max(0,pop-jobs);

    city.demand.residential=clamp(68-pop*.025+housing*.035,5,95);
    city.demand.commercial=clamp(35+pop*.025-city.buildings.filter(b=>b.userData.type==="commercial").length*1.5,5,95);
    city.demand.industrial=clamp(50+unemployment*.03-city.buildings.filter(b=>b.userData.type==="industrial").length*1.2,5,95);
}

function updateHappiness(){
    const employment=city.population?Math.min(1,city.jobs/city.population):1;
    const target=58+employment*20+city.demand.residential*.09;
    city.happiness+=(target-city.happiness)*.08;
    city.happiness=clamp(city.happiness,0,100);
}

let simAccumulator=0;
function updateSimulation(delta){
    if(!city.speed)return;
    city.minutes+=delta*city.speed*8;
    if(city.minutes>=1440){city.minutes-=1440;city.day++}
    simAccumulator+=delta*city.speed;

    if(simAccumulator>=1){
        simAccumulator=0;
        city.money+=city.population*.18+city.jobs*.11-city.roads.length*2-city.buildings.length*1.5;
        updateDemand();
        updateHappiness();
        updateUI();
    }
}

function updateUI(){
    document.getElementById("money").textContent="$"+Math.floor(city.money).toLocaleString();
    document.getElementById("population").textContent=Math.floor(city.population).toLocaleString();
    document.getElementById("jobs").textContent=Math.floor(city.jobs).toLocaleString();
    document.getElementById("happiness").textContent=Math.floor(city.happiness)+"%";
    document.getElementById("regionLevel").textContent=city.mapLevel;
    document.getElementById("mapNameLabel").textContent=selectedMap.name.toUpperCase();
    document.getElementById("mapSizeLabel").textContent=`${selectedMap.size} × ${selectedMap.size}`;
    document.getElementById("expansionLabel").textContent=city.mapLevel>=maps.length?"MAXED":"Available later";

    for(const [id,val] of [
        ["res",city.demand.residential],
        ["com",city.demand.commercial],
        ["ind",city.demand.industrial]
    ]){
        document.getElementById(id+"Demand").style.width=val+"%";
        document.getElementById(id+"DemandText").textContent=Math.round(val)+"%";
    }

    if(city.selectedObject)showObjectInfo(city.selectedObject);
}

function updateClock(){
    const h=Math.floor(city.minutes/60),m=Math.floor(city.minutes%60);
    document.getElementById("clock").textContent=`DAY ${city.day}  ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

let notificationTimer;
function notify(message){
    const e=document.getElementById("notification");
    e.textContent=message;
    e.classList.add("show");
    clearTimeout(notificationTimer);
    notificationTimer=setTimeout(()=>e.classList.remove("show"),1900);
}

function saveCity(){
    const data={
        version:2,
        mapId:city.mapId,
        mapLevel:city.mapLevel,
        money:city.money,
        population:city.population,
        jobs:city.jobs,
        happiness:city.happiness,
        day:city.day,
        minutes:city.minutes,
        demand:city.demand,
        roads:city.roads.map(r=>({...r.userData})),
        zones:city.zones,
        buildings:city.buildings.map(b=>({...b.userData,rotation:b.rotation.y}))
    };
    localStorage.setItem("metroforge-save",JSON.stringify(data));
    notify("City saved");
}

function loadCity(silent=false){
    const raw=localStorage.getItem("metroforge-save");
    if(!raw){if(!silent)notify("No saved city found");return false}
    try{
        const data=JSON.parse(raw);
        city.mapId=data.mapId||"starter";
        city.mapLevel=data.mapLevel||1;
        selectedMap=maps.find(m=>m.id===city.mapId)||maps[0];
        city.money=data.money??50000;
        city.day=data.day??1;
        city.minutes=data.minutes??480;
        city.happiness=data.happiness??75;

        clearWorld();
        buildTerrain();

        for(const r of data.roads||[]){
            const road=createRoad(
                new THREE.Vector3(r.start.x,r.start.y,r.start.z),
                new THREE.Vector3(r.end.x,r.end.y,r.end.z),
                r.roadType||"local",
                false
            );
            road.userData=r;
            city.roads.push(road);
            city.objects.push(road);
            roadGroup.add(road);
        }

        city.zones=(data.zones||[]).map(z=>({...z}));
        rebuildZones();

        for(const b of data.buildings||[]){
            const z=getZone(b.gx,b.gz);
            if(!z)continue;
            const group=new THREE.Group();
            const body=new THREE.Mesh(
                new THREE.BoxGeometry(b.width||5,b.height||8,b.depth||5),
                new THREE.MeshStandardMaterial({
                    color:b.type==="residential"?0xbccbd7:b.type==="commercial"?0xc9b681:0x919b9c,
                    roughness:.75
                })
            );
            body.position.y=(b.height||8)/2;
            const roof=new THREE.Mesh(
                new THREE.BoxGeometry((b.width||5)*1.03,.25,(b.depth||5)*1.03),
                new THREE.MeshStandardMaterial({color:0x5b6268,roughness:.8})
            );
            roof.position.y=(b.height||8)+.13;
            group.add(body,roof);
            group.position.set(b.gx*WORLD.grid,terrainHeight(b.gx*WORLD.grid,b.gz*WORLD.grid),b.gz*WORLD.grid);
            group.rotation.y=b.rotation||0;
            group.userData=b;
            group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
            buildingGroup.add(group);
            city.buildings.push(group);
            city.objects.push(group);
            if(z){z.developed=true;z.growth=100}
        }

        recalculateStats();
        updateDemand();
        rebuildIntersections();
        updateUI();
        if(!silent)notify("City loaded");
        return true;
    }catch(e){
        console.error(e);
        if(!silent)notify("Save data is invalid");
        return false;
    }
}

function newCity(skipConfirm=false){
    if(!skipConfirm&&!confirm("Start a new city? Your current city will be cleared."))return;
    clearWorld();
    city.money=50000;
    city.population=0;
    city.jobs=0;
    city.happiness=75;
    city.day=1;
    city.minutes=480;
    city.speed=0;
    city.demand={residential:65,commercial:45,industrial:55};
    buildTerrain();
    updateUI();
    updateClock();
    setTimeSpeed(0);
    notify("New city created");
}

function clearWorld(){
    clearSelection();
    clearWorldObjects();
}

function clearWorldObjects(){
    while(roadGroup.children.length)disposeObject(roadGroup.children.pop());
    while(buildingGroup.children.length)disposeObject(buildingGroup.children.pop());
    while(zoneGroup.children.length)disposeObject(zoneGroup.children.pop());
    while(intersectionGroup.children.length)disposeObject(intersectionGroup.children.pop());
    while(natureGroup.children.length)disposeObject(natureGroup.children.pop());
    if(terrain){scene.remove(terrain);disposeObject(terrain);terrain=null}
    if(water){scene.remove(water);disposeObject(water);water=null}
    if(grid){scene.remove(grid);disposeObject(grid);grid=null}
    city.roads=[];city.zones=[];city.buildings=[];city.objects=[];
}

function setTimeSpeed(speed){
    city.speed=speed;
    document.querySelectorAll(".time-btn").forEach(b=>b.classList.toggle("active",Number(b.dataset.speed)===speed));
}

document.querySelectorAll(".time-btn").forEach(b=>b.addEventListener("click",()=>setTimeSpeed(Number(b.dataset.speed))));
document.getElementById("saveButton").addEventListener("click",saveCity);
document.getElementById("saveButtonTop").addEventListener("click",saveCity);
document.getElementById("loadButton").addEventListener("click",()=>loadCity());
document.getElementById("newButton").addEventListener("click",()=>newCity());

/* ---------------- MENU / MAPS ---------------- */

function renderMapCards(){
    const wrap=document.getElementById("mapCards");
    wrap.innerHTML="";
    for(const map of maps){
        const unlocked=city.mapLevel>=map.unlock;
        const card=document.createElement("div");
        card.className="map-card"+(unlocked?"":" locked")+(selectedMap.id===map.id?" selected":"");
        card.innerHTML=`
            <div class="map-preview"></div>
            <h3>${map.name}${unlocked?"":" · LOCKED"}</h3>
            <p>${map.description}</p>
            <div class="map-meta"><span>${map.size}×${map.size}</span><span>${unlocked?(map.cost?"$"+map.cost.toLocaleString():"FREE"):"LEVEL "+map.unlock}</span></div>
        `;
        if(unlocked){
            card.addEventListener("click",()=>{
                selectedMap=map;
                renderMapCards();
            });
        }
        wrap.appendChild(card);
    }
}

function enterSelectedMap(){
    city.mapId=selectedMap.id;
    document.getElementById("mapMenu").classList.add("hidden");
    document.getElementById("mainMenu").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    newCity(true);
}

document.getElementById("newGameButton").addEventListener("click",()=>{
    selectedMap=maps[0];
    enterSelectedMap();
});
document.getElementById("continueButton").addEventListener("click",()=>{
    if(loadCity(true)){
        document.getElementById("mainMenu").classList.add("hidden");
        document.getElementById("game").classList.remove("hidden");
    }else{
        selectedMap=maps[0];
        enterSelectedMap();
    }
});
document.getElementById("mapButton").addEventListener("click",()=>{
    renderMapCards();
    document.getElementById("mapMenu").classList.remove("hidden");
});
document.getElementById("closeMapButton").addEventListener("click",()=>document.getElementById("mapMenu").classList.add("hidden"));
document.getElementById("mapConfirmButton").addEventListener("click",enterSelectedMap);

document.getElementById("returnMenuButton").addEventListener("click",()=>{
    saveCity();
    document.getElementById("game").classList.add("hidden");
    document.getElementById("mainMenu").classList.remove("hidden");
});

let soundEnabled=true;
function playChime(){
    if(!soundEnabled)return;
    const audio=document.getElementById("uiChime");
    audio.currentTime=0;
    audio.volume=.7;
    audio.play().catch(()=>{});
}
function updateSoundButtons(){
    const text=soundEnabled?"SOUND ON":"SOUND OFF";
    document.getElementById("soundButton").textContent=soundEnabled?"◉":"○";
    document.getElementById("menuSoundButton").textContent=text;
}
function toggleSound(){
    soundEnabled=!soundEnabled;
    updateSoundButtons();
}
document.getElementById("soundButton").addEventListener("click",toggleSound);
document.getElementById("menuSoundButton").addEventListener("click",toggleSound);

function loadingSequence(){
    const bar=document.getElementById("loadingBar");
    const text=document.getElementById("loadingText");
    const steps=[
        [18,"LOADING TERRAIN ENGINE"],
        [38,"GENERATING REGIONS"],
        [57,"PREPARING ROAD SYSTEM"],
        [76,"INITIALIZING CITY SERVICES"],
        [92,"CALIBRATING ATMOSPHERE"],
        [100,"CITY ENGINE READY"]
    ];
    let i=0;
    const tick=()=>{
        const [value,label]=steps[i++];
        bar.style.width=value+"%";
        text.textContent=label;
        if(i<steps.length)setTimeout(tick,240);
        else setTimeout(()=>{
            playChime();
            document.getElementById("loadingScreen").classList.add("hidden");
            document.getElementById("mainMenu").classList.remove("hidden");
        },420);
    };
    tick();
}

/* ---------------- LOOP ---------------- */

let lastTime=performance.now();

function animate(){
    requestAnimationFrame(animate);
    const now=performance.now();
    const delta=Math.min((now-lastTime)/1000,.05);
    lastTime=now;

    updateSimulation(delta);
    updateCamera(delta);
    updateClock();

    if(roadStart&&city.selectedTool==="road"){
        showBuildPreview(pointerX,pointerY,"ROAD START SELECTED · DRAG TO BUILD");
    }else if(city.selectedTool!=="road"){
        hideBuildPreview();
    }

    renderer.render(scene,camera);
}

window.addEventListener("resize",()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function capitalize(t){return t.charAt(0).toUpperCase()+t.slice(1)}

updateSoundButtons();
renderMapCards();
camera.position.set(80,80,100);
loadingSequence();
animate();
