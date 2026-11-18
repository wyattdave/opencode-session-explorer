"use strict";Object.defineProperties(exports,{__esModule:{value:!0},[Symbol.toStringTag]:{value:"Module"}});const z=require("@opencode/plugin/gui"),F=require("effect"),t=require("solid-js/web"),c=require("solid-js"),je=require("@opencode/plugin/rpc"),Ie=F.Schema.Struct({project:F.Schema.optional(F.Schema.String),archive:F.Schema.optional(F.Schema.String),sort:F.Schema.optional(F.Schema.String),group:F.Schema.optional(F.Schema.Boolean)}),Ae=z.Plugin.define({stores:{prefs:z.Store.global(Ie,{},["plugin.session-explorer.preferences"])},i18n:{en:{"titlebar.label":"Sessions","titlebar.title":"Session Explorer","command.open":"Session Explorer: Open","command.description":"Browse and reopen sessions across every project","dialog.title":"Session Explorer","dialog.description":"Search every project on the connected servers, including archived sessions.","search.label":"Search sessions","search.placeholder":"Search title, project, directory or ID…","filter.project":"Project","filter.allProjects":"All projects","filter.archive":"Session state","filter.all":"All","filter.unarchived":"Unarchived","filter.archived":"Archived","filter.sort":"Sort by","filter.sort.updated":"Last updated","filter.sort.created":"Created","filter.sort.title":"Title","filter.group":"Group by project","filter.reset":"Reset filters","action.refresh":"Refresh","action.cancel":"Cancel","action.open":"Open","action.more":"More actions","action.archive":"Archive","action.restore":"Restore","action.restoreAndOpen":"Restore and open","action.copyId":"Copy session ID","row.archived":"Archived","row.running":"Running","row.missing":"Directory missing","row.untitled":"Untitled session","row.updated":"Updated {{time}}","state.loading":"Loading sessions…","state.connecting":"Connecting to the local server…","state.refreshing":"Refreshing…","state.empty":"No sessions yet","state.empty.description":"Sessions appear here once this server has one.","state.noMatches":"No sessions match these filters","state.noMatches.description":"Try a different search or reset the filters.","state.error":"Could not load sessions","state.partial":"Some servers could not be reached","state.incompatible":"This server's version is not compatible with this app.","state.disconnected":"The event connection to this server is down; results may be stale.","state.stale":"Showing cached results; refresh to update.","state.retry":"Try again","state.showing":"Showing {{shown}} of {{total}} sessions","state.loadMore":"Show more","state.partialCounts":"Counts are partial while sessions load.","toast.copied":"Session ID copied","toast.archived":"Session archived","toast.restored":"Session restored","toast.archiveFailed":"Could not archive the session","toast.restoreFailed":"Could not restore the session","toast.running":"This session is running; stop it before archiving.","confirm.missing.title":"Session directory is missing","confirm.missing.description":"{{directory}} no longer exists on {{server}}. Open the session anyway?","confirm.missing.confirm":"Open anyway","confirm.restore.title":"Restore archived session","confirm.restore.description":"Restore “{{title}}” and open it?","confirm.restore.confirm":"Restore and open","group.count":"{{count}}"}}}),Me=1e3,Ee=je.Rpc.define({id:"session-explorer",methods:{check:{input:{type:"object",properties:{directories:{type:"array",items:{type:"string"},maxItems:Me}},required:["directories"],additionalProperties:!1},output:{type:"object",properties:{missing:{type:"array",items:{type:"string"}}},required:["missing"],additionalProperties:!1}},settings:{input:{type:"object",properties:{},additionalProperties:!1},output:{type:"object",properties:{options:{type:"object",additionalProperties:!0}},required:["options"],additionalProperties:!1}}},events:{}}),De="Untitled session",J="all",Re=`
`;function Te(e,r){return`${e}${Re}${r}`}function le(e,r){return`${encodeURIComponent(e)}+${encodeURIComponent(r)}`}function Ce(e){return e.split(/[\\/]+/).filter(Boolean).at(-1)??e}function ie(e){return typeof e!="number"||!Number.isFinite(e)||e<=0?0:e<1e11?Math.round(e*1e3):Math.round(e)}function ze(e,r){const n=r.find(l=>l.id===e.projectID),i=n?.canonical??e.location.directory,a=n?.name?.trim()||Ce(i);return{id:e.projectID,name:a,directory:i}}function Oe(e,r,n=[],i={}){const a=ze(r,n);return{key:Te(e.id,r.id),serverId:e.id,serverName:e.name,sessionId:r.id,projectId:a.id,projectName:a.name,projectDirectory:a.directory,directory:r.location.directory,subpath:r.subpath||void 0,title:r.title?.trim()||De,createdAt:ie(r.time.created),updatedAt:ie(r.time.updated),archivedAt:r.time.archived===void 0?void 0:ie(r.time.archived),parentId:r.parentID||void 0,running:i.running,directoryStatus:i.directoryStatus??"unknown"}}function xe(e,r){const n=new Map(e.map(i=>[i.key,i]));for(const i of r)n.set(i.key,i);return[...n.values()]}function Pe(e,r,n){if(!(!r||r===e||n.has(r)))return r}function Le(e,r){return r==="archived"?e.archivedAt!==void 0:r==="unarchived"?e.archivedAt===void 0:!0}function Fe(e){return[e.title,e.projectName,e.projectDirectory,e.directory,e.subpath??"",e.sessionId,e.serverName].join(`
`).toLowerCase()}function Ne(e,r){const n=r.trim().toLowerCase();return n.length===0||Fe(e).includes(n)}function Q(e,r){const n=e.toLowerCase(),i=r.toLowerCase();return n<i?-1:n>i?1:0}function qe(e,r){return e.slice().sort((n,i)=>{if(r==="title"){const a=Q(n.title,i.title);if(a!==0)return a}else if(r==="created"){if(n.createdAt!==i.createdAt)return i.createdAt-n.createdAt}else if(n.updatedAt!==i.updatedAt)return i.updatedAt-n.updatedAt;return n.key<i.key?-1:n.key>i.key?1:0})}function Be(e,r,n){const i=r.project,a=e.filter(l=>i!==J&&le(l.serverId,l.projectId)!==i||!Le(l,r.archive)?!1:Ne(l,r.query));return qe(a,n)}function Ke(e){const r=new Map;for(const d of e){const m=le(d.serverId,d.projectId),v=r.get(m);v?v.count++:r.set(m,{row:d,count:1})}const n=[...r.entries()].map(([d,m])=>({key:d,serverId:m.row.serverId,serverName:m.row.serverName,projectId:m.row.projectId,name:m.row.projectName,directory:m.row.projectDirectory,count:m.count})),i=new Map;for(const d of n)i.set(d.name.toLowerCase(),(i.get(d.name.toLowerCase())??0)+1);const a=new Map;for(const d of n)a.set(d.serverId,(a.get(d.serverId)??0)+1);const l=a.size>1,g=new Map;for(const d of n)(i.get(d.name.toLowerCase())??0)<2||g.set(d.key,`${d.name} — ${Ce(d.directory)}`);const b=new Map;for(const d of n){const m=g.get(d.key)??d.name;b.set(m.toLowerCase(),(b.get(m.toLowerCase())??0)+1)}return n.map(d=>{const m=g.get(d.key)??d.name,I=(b.get(m.toLowerCase())??0)>1||l?`${m} · ${d.serverName}`:m;return{...d,name:I}}).sort((d,m)=>Q(d.name,m.name)||Q(d.key,m.key))}function me(e,r){const n=new Map(r.map(a=>[a.key,a.name])),i=new Map;for(const a of e){const l=le(a.serverId,a.projectId),g=i.get(l);g?g.push(a):i.set(l,[a])}return[...i.entries()].map(([a,l])=>{const g=l[0];return{key:a,name:n.get(a)??g.projectName,serverId:g.serverId,directory:g.projectDirectory,sessions:l}}).sort((a,l)=>Q(a.name,l.name)||Q(a.key,l.key))}function Ue(e){let r=0;for(const n of e)n.archivedAt!==void 0&&r++;return{all:e.length,unarchived:e.length-r,archived:r}}function He(e,r=Date.now()){if(e<=0)return"unknown";const n=Math.max(0,Math.round((r-e)/1e3));if(n<45)return"just now";const i=Math.round(n/60);if(i<60)return`${i}m ago`;const a=Math.round(i/60);if(a<24)return`${a}h ago`;const l=Math.round(a/24);return l<7?`${l}d ago`:new Date(e).toLocaleDateString(void 0,{day:"numeric",month:"short",year:"numeric"})}const ae={project:J,archive:"all",sort:"updated",group:!1},Ge=["all","unarchived","archived"],Ve=["updated","created","title"];function Je(e,r){const n=e&&typeof e=="object"?e:{},i=Ge.includes(n.archive)?n.archive:ae.archive,a=Ve.includes(n.sort)?n.sort:ae.sort;return{project:typeof n.project=="string"&&(n.project===J||r===void 0||r.includes(n.project))?n.project:J,archive:i,sort:a,group:n.group===!0}}function Qe(e){return[...new Set(e.map(r=>r.directory).filter(r=>r.length>0))].sort()}const Ye=100,ge=500;function Ze(e){return e instanceof Error&&e.message?e.message:String(e)}function We(e){return{id:e.id,name:e.name||e.id}}async function Xe(e,r){const n=await Promise.allSettled([(async()=>e.project.list({},{signal:r}))(),(async()=>e.project.list({archived:!0},{signal:r}))()]),i=new Map;for(const a of n)if(a.status==="fulfilled")for(const l of a.value)i.set(l.id,l);return[...i.values()]}async function et(e,r){try{const n=await e.session.active({signal:r});return new Set(Object.entries(n).filter(([,i])=>i?.type==="running").map(([i])=>i))}catch{return}}async function tt(e,r,n,i,a,l,g){let b=[],d;const m=new Set;for(;;){if(l.aborted)return b;const v=await e.session.list({order:"desc",limit:Ye,parentID:null,archived:i,...d===void 0?{}:{cursor:d}},{signal:l}),I=v.data.filter(f=>!f.parentID).map(f=>Oe(r,f,n,{running:a?.has(f.id)===!0?!0:void 0}));b=xe(b,I),g(b);const D=Pe(d,v.cursor?.next??void 0,m);if(D===void 0)return b;m.add(D),d=D}}async function rt(e,r,n){const i=We(e),[a,l]=await Promise.all([Xe(e.client,r),et(e.client,r)]);let g=[];const b=d=>{const m=new Set(d.map(v=>v.key));g=xe(g.filter(v=>!m.has(v.key)),d),n(g)};for(const d of[!1,!0]){if(r.aborted)break;await tt(e.client,i,a,d,l,r,b)}return{sessions:g,projects:a}}async function nt(e,r,n,i){const a=new Set,l=new Set;for(let g=0;g<r.length&&!i.aborted;g+=ge){const b=r.slice(g,g+ge);if(b.length!==0)try{const d=await n({directories:b},{signal:i});for(const m of b)l.add(m);for(const m of d.missing)a.add(m)}catch{}}return{missing:a,checked:l}}function ot(e,r){return Qe(e.filter(n=>n.serverId===r))}function it(e,r,n){return e.map(i=>i.serverId!==r?i:n.missing.has(i.directory)?{...i,directoryStatus:"missing"}:n.checked.has(i.directory)?{...i,directoryStatus:"present"}:i)}function se(e){return Ze(e)}const st=new Set(["session.created","session.deleted","session.renamed","session.metadata.updated","session.archived","session.unarchived","session.moved","project.updated"]),at=300;function ct(e){const[r,n]=c.createSignal([]),[i,a]=c.createSignal([]),[l,g]=c.createSignal(!1),[b,d]=c.createSignal(!1),[m,v]=c.createSignal(!1),[I,D]=c.createSignal(void 0),[f,_]=c.createSignal(!1);let A=0,O,x;const S=(h,y,k)=>{const M=h==="default"?void 0:h;e.toast.show({title:y,description:k,variant:M})},P=()=>{if(!f()){v(!0);return}x!==void 0&&clearTimeout(x),x=setTimeout(()=>{x=void 0,q()},at)},q=async()=>{if(!f())return;x!==void 0&&(clearTimeout(x),x=void 0);const h=++A;O?.abort();const y=new AbortController;O=y;const k=y.signal,M=e.servers.list().map(u=>e.servers.get(u)).filter(u=>u!==void 0),E=M.filter(u=>u.compatible!==!1),K=M.filter(u=>u.compatible===!1);if(M.length===0){d(!0),g(!1),v(!1),a([]);return}d(!1),g(!0),v(!1),a([...E.map(u=>({id:u.id,name:u.name||u.id,status:"loading",connected:u.connected})),...K.map(u=>({id:u.id,name:u.name||u.id,status:"incompatible",message:e.t("state.incompatible"),connected:u.connected}))]);const L=new Map;for(const u of r()){const T=L.get(u.serverId);T?T.push(u):L.set(u.serverId,[u])}const U=()=>{h===A&&n([...L.values()].flat())},ne=await Promise.all(E.map(async u=>{try{const T=await rt(u,k,V=>{L.set(u.id,[...V]),U()});if(h!==A||k.aborted)return{server:u,ok:!0};L.set(u.id,T.sessions),U();const Z=ot(T.sessions,u.id);if(Z.length>0){const V=await nt(u,Z,(W,oe)=>u.client.rpc(Ee).check(W,oe),k);if(h!==A||k.aborted)return{server:u,ok:!0};L.set(u.id,it(T.sessions,u.id,V)),U()}return{server:u,ok:!0}}catch(T){return h!==A||k.aborted?{server:u,ok:!0}:{server:u,ok:!1,error:T}}}));if(h!==A)return;const N=new Map;for(const u of ne)u.ok||N.set(u.server.id,se(u.error));a([...E.map(u=>({id:u.id,name:u.name||u.id,status:N.has(u.id)?"error":"ready",message:N.get(u.id),connected:u.connected})),...K.map(u=>({id:u.id,name:u.name||u.id,status:"incompatible",message:e.t("state.incompatible"),connected:u.connected}))]),g(!1),D(Date.now()),N.size>0&&v(!0),E.length===0&&K.length===0&&v(!1)},ee=()=>{f()||(_(!0),q())},te=()=>{_(!1),x!==void 0&&(clearTimeout(x),x=void 0),O?.abort(),O=void 0},Y=async(h,y)=>{const k=e.servers.get(h.serverId);if(!k)return S("error",e.t(y?"toast.archiveFailed":"toast.restoreFailed"),h.serverName),!1;if(y&&h.running===!0)return S("error",e.t("toast.running"),h.title),!1;try{if(await k.client.session.update({sessionID:h.sessionId,archived:y}),!await k.client.session.get({sessionID:h.sessionId}).then(E=>E.time.archived!==void 0===y).catch(()=>!0))return S("error",e.t(y?"toast.archiveFailed":"toast.restoreFailed"),h.title),q(),!1}catch(M){return S("error",e.t(y?"toast.archiveFailed":"toast.restoreFailed"),se(M)),!1}return n(M=>M.map(E=>E.key===h.key?{...E,archivedAt:y?Date.now():void 0,running:y?void 0:E.running}:E)),S("success",e.t(y?"toast.archived":"toast.restored"),h.title),P(),!0},B=async h=>{try{await e.system.copy(h.sessionId),S("success",e.t("toast.copied"),h.sessionId)}catch(y){S("error",e.t("toast.copied"),se(y))}},G=async h=>{if(h.directoryStatus==="missing"&&!await e.dialogs.confirm({title:e.t("confirm.missing.title"),description:e.t("confirm.missing.description",{directory:h.directory,server:h.serverName}),confirm:e.t("confirm.missing.confirm"),cancel:e.t("action.cancel")}))return!1;const y=e.tabs.list().find(k=>k.session?.server.id===h.serverId&&k.session.id===h.sessionId);return y?e.tabs.focus(y.key):e.tabs.open({server:h.serverId,id:h.sessionId},{focus:!0}),!0},re=async h=>await Y(h,!1)?G({...h}):!1;return z.createKeyed(()=>e.servers.list().slice().sort().join("\0"),()=>{const h=[];for(const y of e.servers.list()){const k=e.servers.get(y);if(k)try{h.push(k.data.listen(M=>{st.has(M.name)&&P()}))}catch{}}c.onCleanup(()=>{for(const y of h)y()})}),z.createKeyed(()=>e.servers.list().slice().sort().join("\0"),()=>{f()&&q()}),c.onCleanup(()=>{x!==void 0&&clearTimeout(x),O?.abort(),A++}),{rows:r,servers:i,loading:l,waiting:b,stale:m,updatedAt:I,open:ee,close:te,isOpen:f,refresh:()=>{q()},setArchived:Y,copyId:B,openSession:G,restoreAndOpen:re,toast:S}}function Se(e,r){e.stores.prefs.set({project:r.project,archive:r.archive,sort:r.sort,group:r.group})}function lt(e){Se(e,{...ae,project:J})}var dt=t.template("<div class=se-controls><div class=se-control><span aria-hidden=true></span></div><div class=se-control><span aria-hidden=true></span></div><div class=se-control><span aria-hidden=true></span></div><div class=se-group-toggle></div><span class=se-spacer>");function ut(e){const r=z.usePlugin(),n=r.ui,i=()=>[{value:"all",label:r.t("filter.allProjects")},...e.projects.map(g=>({value:g.key,label:e.showCounts?`${g.name} (${g.count})`:g.name}))],a=()=>[{value:"all",label:e.showCounts?`${r.t("filter.all")} (${e.counts.all})`:r.t("filter.all")},{value:"unarchived",label:e.showCounts?`${r.t("filter.unarchived")} (${e.counts.unarchived})`:r.t("filter.unarchived")},{value:"archived",label:e.showCounts?`${r.t("filter.archived")} (${e.counts.archived})`:r.t("filter.archived")}],l=()=>[{value:"updated",label:r.t("filter.sort.updated")},{value:"created",label:r.t("filter.sort.created")},{value:"title",label:r.t("filter.sort.title")}];return(()=>{var g=dt(),b=g.firstChild,d=b.firstChild,m=b.nextSibling,v=m.firstChild,I=m.nextSibling,D=I.firstChild,f=I.nextSibling;return f.nextSibling,t.insert(d,()=>r.t("filter.project")),t.insert(b,t.createComponent(n.Select,{get label(){return r.t("filter.project")},get options(){return i()},get value(){return e.prefs.project},onChange:_=>e.onChange({project:_})}),null),t.insert(v,()=>r.t("filter.archive")),t.insert(m,t.createComponent(n.Select,{get label(){return r.t("filter.archive")},get options(){return a()},get value(){return e.prefs.archive},onChange:_=>e.onChange({archive:_})}),null),t.insert(D,()=>r.t("filter.sort")),t.insert(I,t.createComponent(n.Select,{get label(){return r.t("filter.sort")},get options(){return l()},get value(){return e.prefs.sort},onChange:_=>e.onChange({sort:_})}),null),t.insert(f,t.createComponent(n.Switch,{get label(){return r.t("filter.group")},get checked(){return e.prefs.group},onChange:_=>e.onChange({group:_})})),t.insert(g,t.createComponent(n.Button,{variant:"ghost",size:"small",get onClick(){return e.onReset},get children(){return r.t("filter.reset")}}),null),t.insert(g,t.createComponent(n.Tooltip,{get value(){return r.t("action.refresh")},get children(){return t.createComponent(n.IconButton,{icon:"refresh",get label(){return r.t("action.refresh")},get busy(){return e.loading},get onClick(){return e.onRefresh}})}}),null),g})()}var pt=t.template("<span>"),ft=t.template("<span class=se-badge data-tone=warning>"),mt=t.template("<span class=se-badge data-tone=running>"),gt=t.template("<span class=se-badge data-tone=missing>"),ht=t.template("<div class=se-row role=option><button type=button class=se-row-main tabindex=-1><span class=se-title></span><span class=se-meta><span class=se-project></span><span></span><span class=se-sr-only></span></span></button><div class=se-row-actions>");function ce(e){return`session-explorer-row-${e.replace(/[^a-zA-Z0-9_-]/g,"_")}`}function vt(e){const r=z.usePlugin(),n=r.ui,i=()=>e.session.archivedAt!==void 0,a=()=>{const l=[{label:r.t("action.open"),icon:"enter",onSelect:e.onOpen}];return i()&&l.push({label:r.t("action.restoreAndOpen"),icon:"archive",onSelect:e.onRestoreAndOpen}),l.push({type:"separator"}),i()?l.push({label:r.t("action.restore"),icon:"arrow-undo-down",onSelect:()=>e.onArchive(!1)}):l.push({label:r.t("action.archive"),icon:"archive",disabled:e.session.running===!0,onSelect:()=>e.onArchive(!0)}),l.push({label:r.t("action.copyId"),icon:"copy",onSelect:e.onCopyId}),l};return(()=>{var l=ht(),g=l.firstChild,b=g.firstChild,d=b.nextSibling,m=d.firstChild,v=m.nextSibling,I=v.nextSibling,D=g.nextSibling;return l.$$click=f=>{f.target?.closest(".se-row-actions")||e.onOpen()},t.addEventListener(l,"mouseenter",e.onActivate),t.insert(b,()=>e.session.title),t.insert(m,()=>e.session.projectName),t.insert(d,t.createComponent(c.Show,{get when(){return e.showServer},get children(){var f=pt();return t.insert(f,()=>e.session.serverName),f}}),v),t.insert(d,t.createComponent(c.Show,{get when(){return i()},get children(){var f=ft();return t.insert(f,()=>r.t("row.archived")),f}}),v),t.insert(d,t.createComponent(c.Show,{get when(){return e.session.running===!0},get children(){var f=mt();return t.insert(f,()=>r.t("row.running")),f}}),v),t.insert(d,t.createComponent(c.Show,{get when(){return e.session.directoryStatus==="missing"},get children(){var f=gt();return t.insert(f,()=>r.t("row.missing")),t.effect(()=>t.setAttribute(f,"title",e.session.directory)),f}}),v),t.insert(v,()=>r.t("row.updated",{time:He(e.session.updatedAt)})),t.insert(I,()=>e.session.directory),D.$$click=f=>f.stopPropagation(),t.insert(D,t.createComponent(n.Button,{size:"small",variant:"ghost",get onClick(){return e.onOpen},get children(){return r.t("action.open")}}),null),t.insert(D,t.createComponent(n.Menu,{get label(){return`${r.t("action.more")}: ${e.session.title}`},get items(){return a()},trigger:"icon",icon:"outline-dots",placement:"bottom-end"}),null),t.effect(f=>{var _=ce(e.session.key),A=e.active,O=e.active,x=e.session.directory,S=e.session.projectDirectory,P=new Date(e.session.updatedAt).toLocaleString();return _!==f.e&&t.setAttribute(l,"id",f.e=_),A!==f.t&&t.setAttribute(l,"data-active",f.t=A),O!==f.a&&t.setAttribute(l,"aria-selected",f.a=O),x!==f.o&&t.setAttribute(g,"title",f.o=x),S!==f.i&&t.setAttribute(m,"title",f.i=S),P!==f.n&&t.setAttribute(v,"title",f.n=P),f},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0}),l})()}t.delegateEvents(["click"]);var yt=t.template("<div class=se-banner data-tone=error><span> "),wt=t.template("<div class=se-banner data-tone=error><span>: "),he=t.template("<div class=se-banner><span>"),ve=t.template("<div class=se-state><span>"),ye=t.template("<div class=se-state><strong></strong><span></span><div class=se-state-actions>"),bt=t.template("<div class=se-state><strong></strong><span>"),we=t.template("<div class=se-list>"),Ct=t.template("<div class=se-root><div class=se-search-row></div><p class=se-sr-only id=session-explorer-help>Search sessions, then use the arrow keys to choose a row and Enter to open it.</p><div class=se-results tabindex=0 role=listbox aria-describedby=session-explorer-help>"),be=t.template("<span>"),xt=t.template("<div class=se-dialog-footer><div class=se-status><span>"),St=t.template("<div>"),$t=t.template("<section><button type=button class=se-group-title><span></span><span class=se-group-count>(<!>)");const X=200;function _t(e){const r=z.usePlugin(),n=r.ui,[i,a]=c.createSignal(""),[l,g]=c.createSignal(""),[b,d]=c.createSignal(X),[m,v]=c.createSignal(void 0),[I,D]=c.createSignal(new Set);let f;c.createEffect(()=>{const o=i();f!==void 0&&clearTimeout(f),f=setTimeout(()=>g(o),180)}),c.onCleanup(()=>{f!==void 0&&clearTimeout(f),e.onClosed()});const _=()=>e.controller.rows(),A=c.createMemo(()=>Ke(_())),O=c.createMemo(()=>A().map(o=>o.key)),x=c.createMemo(()=>Je(r.stores.prefs.value,_().length>0?O():void 0)),S=c.createMemo(()=>Be(_(),{query:l(),project:x().project,archive:x().archive},x().sort)),P=c.createMemo(()=>S().slice(0,b())),q=c.createMemo(()=>me(S(),A())),ee=c.createMemo(()=>me(P(),A())),te=c.createMemo(()=>Ue(_())),Y=c.createMemo(()=>new Set(_().map(o=>o.serverId)).size>1),B=c.createMemo(()=>e.controller.servers().filter(o=>o.status==="error")),G=c.createMemo(()=>e.controller.servers().filter(o=>o.status==="incompatible")),re=c.createMemo(()=>e.controller.servers().filter(o=>!o.connected&&o.status!=="incompatible")),h=c.createMemo(()=>e.controller.servers().length>0),y=c.createMemo(()=>_().length>0),k=c.createMemo(()=>!e.controller.loading()&&!e.controller.waiting()&&!y()&&(B().length>0||!h()));let M="";c.createEffect(()=>{const o=[l(),x().project,x().archive,x().sort].join("\0");o!==M&&(M=o,d(X),v(void 0))}),c.createEffect(()=>{const o=S(),w=m();if(o.length===0){w!==void 0&&v(void 0);return}(w===void 0||!o.some(j=>j.key===w))&&v(o[0].key)}),c.createEffect(()=>{const o=m();o!==void 0&&document.getElementById(ce(o))?.scrollIntoView({block:"nearest"})});let E,K;const L=()=>K?.querySelector("input")??void 0;c.onMount(()=>{e.controller.open();const o=()=>{const j=L();j&&document.activeElement!==j&&j.focus()};o(),queueMicrotask(o);const w=setTimeout(o,60);c.onCleanup(()=>clearTimeout(w))});const U=o=>{const w=S();if(w.length===0)return;const j=m(),C=Math.max(0,w.findIndex($=>$.key===j)),s=Math.min(w.length-1,Math.max(0,C+o)),p=w[s];p&&(v(p.key),s>=b()&&d(s+X))},ne=()=>S().find(o=>o.key===m()),N=()=>{e.controller.close(),e.dialog.close()},u=async o=>{await e.controller.openSession(o)&&N()},T=()=>{const o=ne();o&&u(o)},Z=o=>{const w=o.target,j=w!==null&&K?.contains(w)===!0,C=w===E;if(o.key==="Escape"){o.preventDefault(),N();return}if(o.key==="ArrowDown"){o.preventDefault(),j?(v(S()[0]?.key),E?.focus()):U(1);return}if(o.key==="ArrowUp"){if(j)return;o.preventDefault(),S().findIndex($=>$.key===m())<=0?L()?.focus():U(-1);return}if(o.key==="Home"&&!j){o.preventDefault();const s=S()[0];s&&v(s.key);return}if(o.key==="End"&&!j){o.preventDefault();const s=S(),p=s.at(-1);p&&(v(p.key),d(s.length));return}o.key==="Enter"&&C&&(o.preventDefault(),T())},V=o=>{Se(r,{...x(),...o})},W=()=>{lt(r),a("")},oe=o=>{const w=new Set(I());w.has(o)?w.delete(o):w.add(o),D(w)},$e=o=>q().find(w=>w.key===o)?.sessions.length??0,de=o=>t.createComponent(vt,{session:o,get active(){return m()===o.key},get showServer(){return Y()},onActivate:()=>v(o.key),onOpen:()=>{u(o)},onArchive:w=>{e.controller.setArchived(o,w)},onRestoreAndOpen:async()=>{await e.controller.restoreAndOpen(o)&&N()},onCopyId:()=>{e.controller.copyId(o)}});return t.createComponent(n.Dialog,{get title(){return r.t("titlebar.title")},size:"x-large",get footer(){return(()=>{var o=xt(),w=o.firstChild,j=w.firstChild;return t.insert(w,t.createComponent(c.Show,{get when(){return e.controller.loading()},get children(){return[t.createComponent(n.Loader,{size:"small"}),(()=>{var C=be();return t.insert(C,(()=>{var s=t.memo(()=>!!y());return()=>s()?r.t("state.refreshing"):r.t("state.loading")})()),C})()]}}),j),t.insert(j,()=>r.t("state.showing",{shown:P().length,total:S().length})),t.insert(w,t.createComponent(c.Show,{get when(){return t.memo(()=>!!e.controller.loading())()&&y()},get children(){var C=be();return t.insert(C,()=>r.t("state.partialCounts")),C}}),null),t.insert(o,t.createComponent(c.Show,{get when(){return P().length<S().length},get children(){return t.createComponent(n.Button,{size:"small",onClick:()=>d(C=>C+X),get children(){return r.t("state.loadMore")}})}}),null),t.effect(()=>t.setAttribute(w,"data-tone",B().length>0?"error":void 0)),o})()},get children(){var o=Ct(),w=o.firstChild,j=w.nextSibling,C=j.nextSibling;return o.$$keydown=Z,t.use(s=>K=s,w),t.insert(w,t.createComponent(n.TextInput,{type:"search",autofocus:!0,size:"large",get label(){return r.t("search.label")},get placeholder(){return r.t("search.placeholder")},get value(){return i()},onInput:a,onSubmit:T})),t.insert(o,t.createComponent(ut,{get projects(){return A()},get prefs(){return x()},get counts(){return te()},get showCounts(){return y()},get loading(){return e.controller.loading()},onChange:V,onReset:W,get onRefresh(){return e.controller.refresh}}),C),t.insert(o,t.createComponent(c.Show,{get when(){return G().length>0},get children(){var s=yt(),p=s.firstChild,$=p.firstChild;return t.insert(s,t.createComponent(n.Icon,{name:"circle-exclamation",size:"small"}),p),t.insert(p,()=>r.t("state.incompatible"),$),t.insert(p,()=>G().map(R=>R.name).join(", "),null),s}}),C),t.insert(o,t.createComponent(c.Show,{get when(){return t.memo(()=>B().length>0)()&&y()},get children(){var s=wt(),p=s.firstChild,$=p.firstChild;return t.insert(s,t.createComponent(n.Icon,{name:"circle-exclamation",size:"small"}),p),t.insert(p,()=>r.t("state.partial"),$),t.insert(p,()=>B().map(R=>R.name).join(", "),null),t.insert(s,t.createComponent(n.Button,{size:"small",variant:"ghost",get onClick(){return e.controller.refresh},get children(){return r.t("state.retry")}}),null),s}}),C),t.insert(o,t.createComponent(c.Show,{get when(){return re().length>0},get children(){var s=he(),p=s.firstChild;return t.insert(s,t.createComponent(n.Icon,{name:"circle-exclamation",size:"small"}),p),t.insert(p,()=>r.t("state.disconnected")),s}}),C),t.insert(o,t.createComponent(c.Show,{get when(){return t.memo(()=>!!(e.controller.stale()&&y()))()&&!e.controller.loading()},get children(){var s=he(),p=s.firstChild;return t.insert(s,t.createComponent(n.Icon,{name:"info",size:"small"}),p),t.insert(p,()=>r.t("state.stale")),t.insert(s,t.createComponent(n.Button,{size:"small",variant:"ghost",get onClick(){return e.controller.refresh},get children(){return r.t("state.retry")}}),null),s}}),C),t.use(s=>E=s,C),t.insert(C,t.createComponent(c.Show,{get when(){return e.controller.waiting()},get children(){var s=ve(),p=s.firstChild;return t.insert(s,t.createComponent(n.Loader,{size:"large"}),p),t.insert(p,()=>r.t("state.connecting")),s}}),null),t.insert(C,t.createComponent(c.Show,{get when(){return t.memo(()=>!y())()&&e.controller.loading()},get children(){var s=ve(),p=s.firstChild;return t.insert(s,t.createComponent(n.Loader,{size:"large"}),p),t.insert(p,()=>r.t("state.loading")),s}}),null),t.insert(C,t.createComponent(c.Show,{get when(){return k()},get children(){var s=ye(),p=s.firstChild,$=p.nextSibling,R=$.nextSibling;return t.insert(s,t.createComponent(n.Icon,{name:"circle-exclamation",size:"large"}),p),t.insert(p,()=>r.t("state.error")),t.insert($,()=>B().map(H=>`${H.name}: ${H.message??""}`).join(" · ")),t.insert(R,t.createComponent(n.Button,{size:"small",get onClick(){return e.controller.refresh},get children(){return r.t("state.retry")}})),s}}),null),t.insert(C,t.createComponent(c.Show,{get when(){return t.memo(()=>!y()&&!e.controller.loading()&&!e.controller.waiting())()&&!k()},get children(){var s=bt(),p=s.firstChild,$=p.nextSibling;return t.insert(p,()=>r.t("state.empty")),t.insert($,()=>r.t("state.empty.description")),s}}),null),t.insert(C,t.createComponent(c.Show,{get when(){return t.memo(()=>!!y())()&&S().length===0},get children(){var s=ye(),p=s.firstChild,$=p.nextSibling,R=$.nextSibling;return t.insert(p,()=>r.t("state.noMatches")),t.insert($,()=>r.t("state.noMatches.description")),t.insert(R,t.createComponent(n.Button,{size:"small",onClick:W,get children(){return r.t("filter.reset")}})),s}}),null),t.insert(C,t.createComponent(c.Show,{get when(){return t.memo(()=>S().length>0)()&&!x().group},get children(){var s=we();return t.insert(s,t.createComponent(c.For,{get each(){return P()},children:p=>de(p)})),s}}),null),t.insert(C,t.createComponent(c.Show,{get when(){return t.memo(()=>S().length>0)()&&x().group},get children(){var s=we();return t.insert(s,t.createComponent(c.For,{get each(){return ee()},children:p=>(()=>{var $=$t(),R=$.firstChild,H=R.firstChild,ue=H.nextSibling,_e=ue.firstChild,pe=_e.nextSibling;return pe.nextSibling,R.$$click=()=>oe(p.key),t.insert(R,t.createComponent(n.Icon,{get name(){return I().has(p.key)?"chevron-right":"chevron-down"},size:"small"}),H),t.insert(H,()=>p.name),t.insert(ue,()=>$e(p.key),pe),t.insert($,t.createComponent(c.Show,{get when(){return!I().has(p.key)},get children(){var fe=St();return t.insert(fe,t.createComponent(c.For,{get each(){return p.sessions},children:ke=>de(ke)})),fe}}),null),t.effect(()=>t.setAttribute(R,"aria-expanded",!I().has(p.key))),$})()})),s}}),null),t.effect(s=>{var p=r.t("titlebar.title"),$=m()===void 0?void 0:ce(m());return p!==s.e&&t.setAttribute(C,"aria-label",s.e=p),$!==s.t&&t.setAttribute(C,"aria-activedescendant",s.t=$),s},{e:void 0,t:void 0}),o}})}t.delegateEvents(["keydown","click"]);const kt=`
.se-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  color: inherit;
  font: inherit;
}

.se-root *,
.se-root *::before,
.se-root *::after {
  box-sizing: border-box;
}

.se-search-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.se-search-row > *:first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.se-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.se-control {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 140px;
}

.se-control > span {
  font-size: 12px;
  opacity: 0.65;
  white-space: nowrap;
}

.se-group-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
}

.se-spacer {
  flex: 1 1 auto;
}

.se-results {
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 180px;
  height: min(54vh, 430px);
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 2%, transparent);
}

.se-results:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 55%, transparent);
  outline-offset: 1px;
}

.se-list {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 2px;
}

.se-group-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 10px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.72;
}

.se-group-count {
  font-weight: 400;
  letter-spacing: 0;
  opacity: 0.7;
}

.se-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 7px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  content-visibility: auto;
  contain-intrinsic-size: auto 52px;
}

.se-row:hover {
  background: color-mix(in srgb, currentColor 6%, transparent);
}

.se-row[data-active="true"] {
  background: color-mix(in srgb, currentColor 10%, transparent);
  border-color: color-mix(in srgb, currentColor 16%, transparent);
}

.se-row-main {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.se-row-main:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 55%, transparent);
  outline-offset: 2px;
  border-radius: 4px;
}

.se-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.se-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  font-size: 11.5px;
  line-height: 1.3;
  opacity: 0.68;
  min-width: 0;
}

.se-project {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 24ch;
}

.se-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 5px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  opacity: 0.9;
}

.se-badge[data-tone="warning"] {
  border-color: color-mix(in srgb, #d19a2a 55%, transparent);
  color: color-mix(in srgb, #d19a2a 75%, currentColor);
}

.se-badge[data-tone="missing"] {
  border-color: color-mix(in srgb, #d9534f 55%, transparent);
  color: color-mix(in srgb, #d9534f 70%, currentColor);
}

.se-badge[data-tone="running"] {
  border-color: color-mix(in srgb, #3f9d6b 55%, transparent);
  color: color-mix(in srgb, #3f9d6b 70%, currentColor);
}

.se-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.se-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  width: 100%;
  font-size: 12px;
}

.se-dialog-footer .se-status {
  flex: 1 1 auto;
}

.se-status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  opacity: 0.75;
  min-width: 0;
}

.se-status[data-tone="error"] {
  opacity: 1;
  color: color-mix(in srgb, #d9534f 78%, currentColor);
}

.se-status[data-tone="warning"] {
  opacity: 1;
  color: color-mix(in srgb, #d19a2a 80%, currentColor);
}

.se-state {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 34px 16px;
  text-align: center;
  font-size: 13px;
  opacity: 0.8;
}

.se-state strong {
  font-size: 14px;
  opacity: 1;
}

.se-state-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.se-banner {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  padding: 7px 9px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid color-mix(in srgb, #d19a2a 45%, transparent);
  color: color-mix(in srgb, #d19a2a 80%, currentColor);
}

.se-banner[data-tone="error"] {
  border-color: color-mix(in srgb, #d9534f 45%, transparent);
  color: color-mix(in srgb, #d9534f 80%, currentColor);
}

.se-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 560px) {
  .se-results {
    height: min(42vh, 280px);
  }
  .se-control {
    min-width: 0;
    flex: 1 1 130px;
  }
  .se-project {
    max-width: 14ch;
  }
  .se-row-actions .se-open-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .se-root * {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
`,jt=e=>{const r=ct(e);let n,i=!1;const a=()=>{i||(i=!0,n=e.dialogs.open(l=>t.createComponent(_t,{dialog:l,controller:r,onClosed:()=>{i=!1,n=void 0,r.close()}})),setTimeout(()=>{r.isOpen()||(i=!1)},750))};return e.add(z.Style,kt),e.add(z.Command,()=>({id:"open",title:e.t("command.open"),description:e.t("command.description"),keywords:"session history archive browse reopen",group:e.t("titlebar.title"),section:"navigation",bind:"mod+shift+h",featured:!0,run:a})),e.add(z.TitlebarItem,()=>({id:"open",label:e.t("titlebar.label"),title:e.t("titlebar.title"),icon:"outline-list-changelog",run:a})),()=>{n?.close(),r.close()}},It=z.Plugin.define({...Ae,setup:jt});exports.default=It;
