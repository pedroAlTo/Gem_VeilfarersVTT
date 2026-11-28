import{L as lr,a as f,_ as ar,C as Jt,r as ns,s as b,j as vn,c as Y,b as _e,m as ut,d as cr,S as hr,e as ur,f as Xe,g as pe,h as dr,i as fr,D as B,q as _r,k as pr,l as mr,n as Zt,o as Ws,p as gr,t as F,u as yr,v as St,w as vr,x as Cr,P as ss,y as Er,z as wr,A as Us,B as Tr,E as Ir,F as Sr,G as Nr,H as Rr,I as br}from"./firebase-core-Ot02WY9l.js";var is={};const rs="@firebase/database",os="1.1.5";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Bs="";function Vs(n){Bs=n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kr{constructor(e){this.domStorage_=e,this.prefix_="firebase:"}set(e,t){t==null?this.domStorage_.removeItem(this.prefixedName_(e)):this.domStorage_.setItem(this.prefixedName_(e),b(t))}get(e){const t=this.domStorage_.getItem(this.prefixedName_(e));return t==null?null:vn(t)}remove(e){this.domStorage_.removeItem(this.prefixedName_(e))}prefixedName_(e){return this.prefix_+e}toString(){return this.domStorage_.toString()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pr{constructor(){this.cache_={},this.isInMemoryStorage=!0}set(e,t){t==null?delete this.cache_[e]:this.cache_[e]=t}get(e){return Y(this.cache_,e)?this.cache_[e]:null}remove(e){delete this.cache_[e]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gs=function(n){try{if(typeof window<"u"&&typeof window[n]<"u"){const e=window[n];return e.setItem("firebase:sentinel","cache"),e.removeItem("firebase:sentinel"),new kr(e)}}catch{}return new Pr},de=Gs("localStorage"),en=Gs("sessionStorage");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ie=new lr("@firebase/database"),Hs=(function(){let n=1;return function(){return n++}})(),Qs=function(n){const e=cr(n),t=new hr;t.update(e);const s=t.digest();return ur.encodeByteArray(s)},Je=function(...n){let e="";for(let t=0;t<n.length;t++){const s=n[t];Array.isArray(s)||s&&typeof s=="object"&&typeof s.length=="number"?e+=Je.apply(null,s):typeof s=="object"?e+=b(s):e+=s,e+=" "}return e};let fe=null,ls=!0;const qs=function(n,e){f(!e||n===!0||n===!1,"Can't turn on custom loggers persistently."),n===!0?(Ie.logLevel=fr.VERBOSE,fe=Ie.log.bind(Ie),e&&en.set("logging_enabled",!0)):typeof n=="function"?fe=n:(fe=null,en.remove("logging_enabled"))},x=function(...n){if(ls===!0&&(ls=!1,fe===null&&en.get("logging_enabled")===!0&&qs(!0)),fe){const e=Je.apply(null,n);fe(e)}},Ze=function(n){return function(...e){x(n,...e)}},tn=function(...n){const e="FIREBASE INTERNAL ERROR: "+Je(...n);Ie.error(e)},X=function(...n){const e=`FIREBASE FATAL ERROR: ${Je(...n)}`;throw Ie.error(e),new Error(e)},O=function(...n){const e="FIREBASE WARNING: "+Je(...n);Ie.warn(e)},xr=function(){typeof window<"u"&&window.location&&window.location.protocol&&window.location.protocol.indexOf("https:")!==-1&&O("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().")},Nt=function(n){return typeof n=="number"&&(n!==n||n===Number.POSITIVE_INFINITY||n===Number.NEGATIVE_INFINITY)},Ar=function(n){if(document.readyState==="complete")n();else{let e=!1;const t=function(){if(!document.body){setTimeout(t,Math.floor(10));return}e||(e=!0,n())};document.addEventListener?(document.addEventListener("DOMContentLoaded",t,!1),window.addEventListener("load",t,!1)):document.attachEvent&&(document.attachEvent("onreadystatechange",()=>{document.readyState==="complete"&&t()}),window.attachEvent("onload",t))}},re="[MIN_NAME]",ee="[MAX_NAME]",ve=function(n,e){if(n===e)return 0;if(n===re||e===ee)return-1;if(e===re||n===ee)return 1;{const t=as(n),s=as(e);return t!==null?s!==null?t-s===0?n.length-e.length:t-s:-1:s!==null?1:n<e?-1:1}},Dr=function(n,e){return n===e?0:n<e?-1:1},Le=function(n,e){if(e&&n in e)return e[n];throw new Error("Missing required key ("+n+") in object: "+b(e))},Cn=function(n){if(typeof n!="object"||n===null)return b(n);const e=[];for(const s in n)e.push(s);e.sort();let t="{";for(let s=0;s<e.length;s++)s!==0&&(t+=","),t+=b(e[s]),t+=":",t+=Cn(n[e[s]]);return t+="}",t},Ys=function(n,e){const t=n.length;if(t<=e)return[n];const s=[];for(let i=0;i<t;i+=e)i+e>t?s.push(n.substring(i,t)):s.push(n.substring(i,i+e));return s};function A(n,e){for(const t in n)n.hasOwnProperty(t)&&e(t,n[t])}const Ks=function(n){f(!Nt(n),"Invalid JSON number");const e=11,t=52,s=(1<<e-1)-1;let i,r,o,l,a;n===0?(r=0,o=0,i=1/n===-1/0?1:0):(i=n<0,n=Math.abs(n),n>=Math.pow(2,1-s)?(l=Math.min(Math.floor(Math.log(n)/Math.LN2),s),r=l+s,o=Math.round(n*Math.pow(2,t-l)-Math.pow(2,t))):(r=0,o=Math.round(n/Math.pow(2,1-s-t))));const c=[];for(a=t;a;a-=1)c.push(o%2?1:0),o=Math.floor(o/2);for(a=e;a;a-=1)c.push(r%2?1:0),r=Math.floor(r/2);c.push(i?1:0),c.reverse();const h=c.join("");let u="";for(a=0;a<64;a+=8){let d=parseInt(h.substr(a,8),2).toString(16);d.length===1&&(d="0"+d),u=u+d}return u.toLowerCase()},Or=function(){return!!(typeof window=="object"&&window.chrome&&window.chrome.extension&&!/^chrome/.test(window.location.href))},Mr=function(){return typeof Windows=="object"&&typeof Windows.UI=="object"};function Lr(n,e){let t="Unknown Error";n==="too_big"?t="The data requested exceeds the maximum size that can be accessed with a single request.":n==="permission_denied"?t="Client doesn't have permission to access the desired data.":n==="unavailable"&&(t="The service is unavailable");const s=new Error(n+" at "+e._path.toString()+": "+t);return s.code=n.toUpperCase(),s}const Fr=new RegExp("^-?(0*)\\d{1,10}$"),Wr=-2147483648,Ur=2147483647,as=function(n){if(Fr.test(n)){const e=Number(n);if(e>=Wr&&e<=Ur)return e}return null},Ae=function(n){try{n()}catch(e){setTimeout(()=>{const t=e.stack||"";throw O("Exception was thrown by user callback.",t),e},Math.floor(0))}},Br=function(){return(typeof window=="object"&&window.navigator&&window.navigator.userAgent||"").search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i)>=0},Be=function(n,e){const t=setTimeout(n,e);return typeof t=="number"&&typeof Deno<"u"&&Deno.unrefTimer?Deno.unrefTimer(t):typeof t=="object"&&t.unref&&t.unref(),t};/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vr{constructor(e,t){this.appCheckProvider=t,this.appName=e.name,dr(e)&&e.settings.appCheckToken&&(this.serverAppAppCheckToken=e.settings.appCheckToken),this.appCheck=t==null?void 0:t.getImmediate({optional:!0}),this.appCheck||t==null||t.get().then(s=>this.appCheck=s)}getToken(e){if(this.serverAppAppCheckToken){if(e)throw new Error("Attempted reuse of `FirebaseServerApp.appCheckToken` after previous usage failed.");return Promise.resolve({token:this.serverAppAppCheckToken})}return this.appCheck?this.appCheck.getToken(e):new Promise((t,s)=>{setTimeout(()=>{this.appCheck?this.getToken(e).then(t,s):t(null)},0)})}addTokenChangeListener(e){var t;(t=this.appCheckProvider)==null||t.get().then(s=>s.addTokenListener(e))}notifyForInvalidToken(){O(`Provided AppCheck credentials for the app named "${this.appName}" are invalid. This usually indicates your app was not initialized correctly.`)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gr{constructor(e,t,s){this.appName_=e,this.firebaseOptions_=t,this.authProvider_=s,this.auth_=null,this.auth_=s.getImmediate({optional:!0}),this.auth_||s.onInit(i=>this.auth_=i)}getToken(e){return this.auth_?this.auth_.getToken(e).catch(t=>t&&t.code==="auth/token-not-initialized"?(x("Got auth/token-not-initialized error.  Treating as null token."),null):Promise.reject(t)):new Promise((t,s)=>{setTimeout(()=>{this.auth_?this.getToken(e).then(t,s):t(null)},0)})}addTokenChangeListener(e){this.auth_?this.auth_.addAuthTokenListener(e):this.authProvider_.get().then(t=>t.addAuthTokenListener(e))}removeTokenChangeListener(e){this.authProvider_.get().then(t=>t.removeAuthTokenListener(e))}notifyForInvalidToken(){let e='Provided authentication credentials for the app named "'+this.appName_+'" are invalid. This usually indicates your app was not initialized correctly. ';"credential"in this.firebaseOptions_?e+='Make sure the "credential" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':"serviceAccount"in this.firebaseOptions_?e+='Make sure the "serviceAccount" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':e+='Make sure the "apiKey" and "databaseURL" properties provided to initializeApp() match the values provided for your app at https://console.firebase.google.com/.',O(e)}}class Se{constructor(e){this.accessToken=e}getToken(e){return Promise.resolve({accessToken:this.accessToken})}addTokenChangeListener(e){e(this.accessToken)}removeTokenChangeListener(e){}notifyForInvalidToken(){}}Se.OWNER="owner";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const En="5",zs="v",js="s",$s="r",Xs="f",Js=/(console\.firebase|firebase-console-\w+\.corp|firebase\.corp)\.google\.com/,Zs="ls",ei="p",nn="ac",ti="websocket",ni="long_polling";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class si{constructor(e,t,s,i,r=!1,o="",l=!1,a=!1,c=null){this.secure=t,this.namespace=s,this.webSocketOnly=i,this.nodeAdmin=r,this.persistenceKey=o,this.includeNamespaceInQueryParams=l,this.isUsingEmulator=a,this.emulatorOptions=c,this._host=e.toLowerCase(),this._domain=this._host.substr(this._host.indexOf(".")+1),this.internalHost=de.get("host:"+e)||this._host}isCacheableHost(){return this.internalHost.substr(0,2)==="s-"}isCustomHost(){return this._domain!=="firebaseio.com"&&this._domain!=="firebaseio-demo.com"}get host(){return this._host}set host(e){e!==this.internalHost&&(this.internalHost=e,this.isCacheableHost()&&de.set("host:"+this._host,this.internalHost))}toString(){let e=this.toURLString();return this.persistenceKey&&(e+="<"+this.persistenceKey+">"),e}toURLString(){const e=this.secure?"https://":"http://",t=this.includeNamespaceInQueryParams?`?ns=${this.namespace}`:"";return`${e}${this.host}/${t}`}}function Hr(n){return n.host!==n.internalHost||n.isCustomHost()||n.includeNamespaceInQueryParams}function ii(n,e,t){f(typeof e=="string","typeof type must == string"),f(typeof t=="object","typeof params must == object");let s;if(e===ti)s=(n.secure?"wss://":"ws://")+n.internalHost+"/.ws?";else if(e===ni)s=(n.secure?"https://":"http://")+n.internalHost+"/.lp?";else throw new Error("Unknown connection type: "+e);Hr(n)&&(t.ns=n.namespace);const i=[];return A(t,(r,o)=>{i.push(r+"="+o)}),s+i.join("&")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qr{constructor(){this.counters_={}}incrementCounter(e,t=1){Y(this.counters_,e)||(this.counters_[e]=0),this.counters_[e]+=t}get(){return yr(this.counters_)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qt={},Yt={};function wn(n){const e=n.toString();return qt[e]||(qt[e]=new Qr),qt[e]}function qr(n,e){const t=n.toString();return Yt[t]||(Yt[t]=e()),Yt[t]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yr{constructor(e){this.onMessage_=e,this.pendingResponses=[],this.currentResponseNum=0,this.closeAfterResponse=-1,this.onClose=null}closeAfter(e,t){this.closeAfterResponse=e,this.onClose=t,this.closeAfterResponse<this.currentResponseNum&&(this.onClose(),this.onClose=null)}handleResponse(e,t){for(this.pendingResponses[e]=t;this.pendingResponses[this.currentResponseNum];){const s=this.pendingResponses[this.currentResponseNum];delete this.pendingResponses[this.currentResponseNum];for(let i=0;i<s.length;++i)s[i]&&Ae(()=>{this.onMessage_(s[i])});if(this.currentResponseNum===this.closeAfterResponse){this.onClose&&(this.onClose(),this.onClose=null);break}this.currentResponseNum++}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cs="start",Kr="close",zr="pLPCommand",jr="pRTLPCB",ri="id",oi="pw",li="ser",$r="cb",Xr="seg",Jr="ts",Zr="d",eo="dframe",ai=1870,ci=30,to=ai-ci,no=25e3,so=3e4;class te{constructor(e,t,s,i,r,o,l){this.connId=e,this.repoInfo=t,this.applicationId=s,this.appCheckToken=i,this.authToken=r,this.transportSessionId=o,this.lastSessionId=l,this.bytesSent=0,this.bytesReceived=0,this.everConnected_=!1,this.log_=Ze(e),this.stats_=wn(t),this.urlFn=a=>(this.appCheckToken&&(a[nn]=this.appCheckToken),ii(t,ni,a))}open(e,t){this.curSegmentNum=0,this.onDisconnect_=t,this.myPacketOrderer=new Yr(e),this.isClosed_=!1,this.connectTimeoutTimer_=setTimeout(()=>{this.log_("Timed out trying to connect."),this.onClosed_(),this.connectTimeoutTimer_=null},Math.floor(so)),Ar(()=>{if(this.isClosed_)return;this.scriptTagHolder=new Tn((...r)=>{const[o,l,a,c,h]=r;if(this.incrementIncomingBytes_(r),!!this.scriptTagHolder)if(this.connectTimeoutTimer_&&(clearTimeout(this.connectTimeoutTimer_),this.connectTimeoutTimer_=null),this.everConnected_=!0,o===cs)this.id=l,this.password=a;else if(o===Kr)l?(this.scriptTagHolder.sendNewPolls=!1,this.myPacketOrderer.closeAfter(l,()=>{this.onClosed_()})):this.onClosed_();else throw new Error("Unrecognized command received: "+o)},(...r)=>{const[o,l]=r;this.incrementIncomingBytes_(r),this.myPacketOrderer.handleResponse(o,l)},()=>{this.onClosed_()},this.urlFn);const s={};s[cs]="t",s[li]=Math.floor(Math.random()*1e8),this.scriptTagHolder.uniqueCallbackIdentifier&&(s[$r]=this.scriptTagHolder.uniqueCallbackIdentifier),s[zs]=En,this.transportSessionId&&(s[js]=this.transportSessionId),this.lastSessionId&&(s[Zs]=this.lastSessionId),this.applicationId&&(s[ei]=this.applicationId),this.appCheckToken&&(s[nn]=this.appCheckToken),typeof location<"u"&&location.hostname&&Js.test(location.hostname)&&(s[$s]=Xs);const i=this.urlFn(s);this.log_("Connecting via long-poll to "+i),this.scriptTagHolder.addTag(i,()=>{})})}start(){this.scriptTagHolder.startLongPoll(this.id,this.password),this.addDisconnectPingFrame(this.id,this.password)}static forceAllow(){te.forceAllow_=!0}static forceDisallow(){te.forceDisallow_=!0}static isAvailable(){return te.forceAllow_?!0:!te.forceDisallow_&&typeof document<"u"&&document.createElement!=null&&!Or()&&!Mr()}markConnectionHealthy(){}shutdown_(){this.isClosed_=!0,this.scriptTagHolder&&(this.scriptTagHolder.close(),this.scriptTagHolder=null),this.myDisconnFrame&&(document.body.removeChild(this.myDisconnFrame),this.myDisconnFrame=null),this.connectTimeoutTimer_&&(clearTimeout(this.connectTimeoutTimer_),this.connectTimeoutTimer_=null)}onClosed_(){this.isClosed_||(this.log_("Longpoll is closing itself"),this.shutdown_(),this.onDisconnect_&&(this.onDisconnect_(this.everConnected_),this.onDisconnect_=null))}close(){this.isClosed_||(this.log_("Longpoll is being closed."),this.shutdown_())}send(e){const t=b(e);this.bytesSent+=t.length,this.stats_.incrementCounter("bytes_sent",t.length);const s=vr(t),i=Ys(s,to);for(let r=0;r<i.length;r++)this.scriptTagHolder.enqueueSegment(this.curSegmentNum,i.length,i[r]),this.curSegmentNum++}addDisconnectPingFrame(e,t){this.myDisconnFrame=document.createElement("iframe");const s={};s[eo]="t",s[ri]=e,s[oi]=t,this.myDisconnFrame.src=this.urlFn(s),this.myDisconnFrame.style.display="none",document.body.appendChild(this.myDisconnFrame)}incrementIncomingBytes_(e){const t=b(e).length;this.bytesReceived+=t,this.stats_.incrementCounter("bytes_received",t)}}class Tn{constructor(e,t,s,i){this.onDisconnect=s,this.urlFn=i,this.outstandingRequests=new Set,this.pendingSegs=[],this.currentSerial=Math.floor(Math.random()*1e8),this.sendNewPolls=!0;{this.uniqueCallbackIdentifier=Hs(),window[zr+this.uniqueCallbackIdentifier]=e,window[jr+this.uniqueCallbackIdentifier]=t,this.myIFrame=Tn.createIFrame_();let r="";this.myIFrame.src&&this.myIFrame.src.substr(0,11)==="javascript:"&&(r='<script>document.domain="'+document.domain+'";<\/script>');const o="<html><body>"+r+"</body></html>";try{this.myIFrame.doc.open(),this.myIFrame.doc.write(o),this.myIFrame.doc.close()}catch(l){x("frame writing exception"),l.stack&&x(l.stack),x(l)}}}static createIFrame_(){const e=document.createElement("iframe");if(e.style.display="none",document.body){document.body.appendChild(e);try{e.contentWindow.document||x("No IE domain setting required")}catch{const s=document.domain;e.src="javascript:void((function(){document.open();document.domain='"+s+"';document.close();})())"}}else throw"Document body has not initialized. Wait to initialize Firebase until after the document is ready.";return e.contentDocument?e.doc=e.contentDocument:e.contentWindow?e.doc=e.contentWindow.document:e.document&&(e.doc=e.document),e}close(){this.alive=!1,this.myIFrame&&(this.myIFrame.doc.body.textContent="",setTimeout(()=>{this.myIFrame!==null&&(document.body.removeChild(this.myIFrame),this.myIFrame=null)},Math.floor(0)));const e=this.onDisconnect;e&&(this.onDisconnect=null,e())}startLongPoll(e,t){for(this.myID=e,this.myPW=t,this.alive=!0;this.newRequest_(););}newRequest_(){if(this.alive&&this.sendNewPolls&&this.outstandingRequests.size<(this.pendingSegs.length>0?2:1)){this.currentSerial++;const e={};e[ri]=this.myID,e[oi]=this.myPW,e[li]=this.currentSerial;let t=this.urlFn(e),s="",i=0;for(;this.pendingSegs.length>0&&this.pendingSegs[0].d.length+ci+s.length<=ai;){const o=this.pendingSegs.shift();s=s+"&"+Xr+i+"="+o.seg+"&"+Jr+i+"="+o.ts+"&"+Zr+i+"="+o.d,i++}return t=t+s,this.addLongPollTag_(t,this.currentSerial),!0}else return!1}enqueueSegment(e,t,s){this.pendingSegs.push({seg:e,ts:t,d:s}),this.alive&&this.newRequest_()}addLongPollTag_(e,t){this.outstandingRequests.add(t);const s=()=>{this.outstandingRequests.delete(t),this.newRequest_()},i=setTimeout(s,Math.floor(no)),r=()=>{clearTimeout(i),s()};this.addTag(e,r)}addTag(e,t){setTimeout(()=>{try{if(!this.sendNewPolls)return;const s=this.myIFrame.doc.createElement("script");s.type="text/javascript",s.async=!0,s.src=e,s.onload=s.onreadystatechange=function(){const i=s.readyState;(!i||i==="loaded"||i==="complete")&&(s.onload=s.onreadystatechange=null,s.parentNode&&s.parentNode.removeChild(s),t())},s.onerror=()=>{x("Long-poll script failed to load: "+e),this.sendNewPolls=!1,this.close()},this.myIFrame.doc.body.appendChild(s)}catch{}},Math.floor(1))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const io=16384,ro=45e3;let dt=null;typeof MozWebSocket<"u"?dt=MozWebSocket:typeof WebSocket<"u"&&(dt=WebSocket);class V{constructor(e,t,s,i,r,o,l){this.connId=e,this.applicationId=s,this.appCheckToken=i,this.authToken=r,this.keepaliveTimer=null,this.frames=null,this.totalFrames=0,this.bytesSent=0,this.bytesReceived=0,this.log_=Ze(this.connId),this.stats_=wn(t),this.connURL=V.connectionURL_(t,o,l,i,s),this.nodeAdmin=t.nodeAdmin}static connectionURL_(e,t,s,i,r){const o={};return o[zs]=En,typeof location<"u"&&location.hostname&&Js.test(location.hostname)&&(o[$s]=Xs),t&&(o[js]=t),s&&(o[Zs]=s),i&&(o[nn]=i),r&&(o[ei]=r),ii(e,ti,o)}open(e,t){this.onDisconnect=t,this.onMessage=e,this.log_("Websocket connecting to "+this.connURL),this.everConnected_=!1,de.set("previous_websocket_failure",!0);try{let s;Cr(),this.mySock=new dt(this.connURL,[],s)}catch(s){this.log_("Error instantiating WebSocket.");const i=s.message||s.data;i&&this.log_(i),this.onClosed_();return}this.mySock.onopen=()=>{this.log_("Websocket connected."),this.everConnected_=!0},this.mySock.onclose=()=>{this.log_("Websocket connection was disconnected."),this.mySock=null,this.onClosed_()},this.mySock.onmessage=s=>{this.handleIncomingFrame(s)},this.mySock.onerror=s=>{this.log_("WebSocket error.  Closing connection.");const i=s.message||s.data;i&&this.log_(i),this.onClosed_()}}start(){}static forceDisallow(){V.forceDisallow_=!0}static isAvailable(){let e=!1;if(typeof navigator<"u"&&navigator.userAgent){const t=/Android ([0-9]{0,}\.[0-9]{0,})/,s=navigator.userAgent.match(t);s&&s.length>1&&parseFloat(s[1])<4.4&&(e=!0)}return!e&&dt!==null&&!V.forceDisallow_}static previouslyFailed(){return de.isInMemoryStorage||de.get("previous_websocket_failure")===!0}markConnectionHealthy(){de.remove("previous_websocket_failure")}appendFrame_(e){if(this.frames.push(e),this.frames.length===this.totalFrames){const t=this.frames.join("");this.frames=null;const s=vn(t);this.onMessage(s)}}handleNewFrameCount_(e){this.totalFrames=e,this.frames=[]}extractFrameCount_(e){if(f(this.frames===null,"We already have a frame buffer"),e.length<=6){const t=Number(e);if(!isNaN(t))return this.handleNewFrameCount_(t),null}return this.handleNewFrameCount_(1),e}handleIncomingFrame(e){if(this.mySock===null)return;const t=e.data;if(this.bytesReceived+=t.length,this.stats_.incrementCounter("bytes_received",t.length),this.resetKeepAlive(),this.frames!==null)this.appendFrame_(t);else{const s=this.extractFrameCount_(t);s!==null&&this.appendFrame_(s)}}send(e){this.resetKeepAlive();const t=b(e);this.bytesSent+=t.length,this.stats_.incrementCounter("bytes_sent",t.length);const s=Ys(t,io);s.length>1&&this.sendString_(String(s.length));for(let i=0;i<s.length;i++)this.sendString_(s[i])}shutdown_(){this.isClosed_=!0,this.keepaliveTimer&&(clearInterval(this.keepaliveTimer),this.keepaliveTimer=null),this.mySock&&(this.mySock.close(),this.mySock=null)}onClosed_(){this.isClosed_||(this.log_("WebSocket is closing itself"),this.shutdown_(),this.onDisconnect&&(this.onDisconnect(this.everConnected_),this.onDisconnect=null))}close(){this.isClosed_||(this.log_("WebSocket is being closed"),this.shutdown_())}resetKeepAlive(){clearInterval(this.keepaliveTimer),this.keepaliveTimer=setInterval(()=>{this.mySock&&this.sendString_("0"),this.resetKeepAlive()},Math.floor(ro))}sendString_(e){try{this.mySock.send(e)}catch(t){this.log_("Exception thrown from WebSocket.send():",t.message||t.data,"Closing connection."),setTimeout(this.onClosed_.bind(this),0)}}}V.responsesRequiredToBeHealthy=2;V.healthyTimeout=3e4;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ne{static get ALL_TRANSPORTS(){return[te,V]}static get IS_TRANSPORT_INITIALIZED(){return this.globalTransportInitialized_}constructor(e){this.initTransports_(e)}initTransports_(e){const t=V&&V.isAvailable();let s=t&&!V.previouslyFailed();if(e.webSocketOnly&&(t||O("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."),s=!0),s)this.transports_=[V];else{const i=this.transports_=[];for(const r of Ne.ALL_TRANSPORTS)r&&r.isAvailable()&&i.push(r);Ne.globalTransportInitialized_=!0}}initialTransport(){if(this.transports_.length>0)return this.transports_[0];throw new Error("No transports available")}upgradeTransport(){return this.transports_.length>1?this.transports_[1]:null}}Ne.globalTransportInitialized_=!1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const oo=6e4,lo=5e3,ao=10*1024,co=100*1024,Kt="t",hs="d",ho="s",us="r",uo="e",ds="o",fs="a",_s="n",ps="p",fo="h";class _o{constructor(e,t,s,i,r,o,l,a,c,h){this.id=e,this.repoInfo_=t,this.applicationId_=s,this.appCheckToken_=i,this.authToken_=r,this.onMessage_=o,this.onReady_=l,this.onDisconnect_=a,this.onKill_=c,this.lastSessionId=h,this.connectionCount=0,this.pendingDataMessages=[],this.state_=0,this.log_=Ze("c:"+this.id+":"),this.transportManager_=new Ne(t),this.log_("Connection created"),this.start_()}start_(){const e=this.transportManager_.initialTransport();this.conn_=new e(this.nextTransportId_(),this.repoInfo_,this.applicationId_,this.appCheckToken_,this.authToken_,null,this.lastSessionId),this.primaryResponsesRequired_=e.responsesRequiredToBeHealthy||0;const t=this.connReceiver_(this.conn_),s=this.disconnReceiver_(this.conn_);this.tx_=this.conn_,this.rx_=this.conn_,this.secondaryConn_=null,this.isHealthy_=!1,setTimeout(()=>{this.conn_&&this.conn_.open(t,s)},Math.floor(0));const i=e.healthyTimeout||0;i>0&&(this.healthyTimeout_=Be(()=>{this.healthyTimeout_=null,this.isHealthy_||(this.conn_&&this.conn_.bytesReceived>co?(this.log_("Connection exceeded healthy timeout but has received "+this.conn_.bytesReceived+" bytes.  Marking connection healthy."),this.isHealthy_=!0,this.conn_.markConnectionHealthy()):this.conn_&&this.conn_.bytesSent>ao?this.log_("Connection exceeded healthy timeout but has sent "+this.conn_.bytesSent+" bytes.  Leaving connection alive."):(this.log_("Closing unhealthy connection after timeout."),this.close()))},Math.floor(i)))}nextTransportId_(){return"c:"+this.id+":"+this.connectionCount++}disconnReceiver_(e){return t=>{e===this.conn_?this.onConnectionLost_(t):e===this.secondaryConn_?(this.log_("Secondary connection lost."),this.onSecondaryConnectionLost_()):this.log_("closing an old connection")}}connReceiver_(e){return t=>{this.state_!==2&&(e===this.rx_?this.onPrimaryMessageReceived_(t):e===this.secondaryConn_?this.onSecondaryMessageReceived_(t):this.log_("message on old connection"))}}sendRequest(e){const t={t:"d",d:e};this.sendData_(t)}tryCleanupConnection(){this.tx_===this.secondaryConn_&&this.rx_===this.secondaryConn_&&(this.log_("cleaning up and promoting a connection: "+this.secondaryConn_.connId),this.conn_=this.secondaryConn_,this.secondaryConn_=null)}onSecondaryControl_(e){if(Kt in e){const t=e[Kt];t===fs?this.upgradeIfSecondaryHealthy_():t===us?(this.log_("Got a reset on secondary, closing it"),this.secondaryConn_.close(),(this.tx_===this.secondaryConn_||this.rx_===this.secondaryConn_)&&this.close()):t===ds&&(this.log_("got pong on secondary."),this.secondaryResponsesRequired_--,this.upgradeIfSecondaryHealthy_())}}onSecondaryMessageReceived_(e){const t=Le("t",e),s=Le("d",e);if(t==="c")this.onSecondaryControl_(s);else if(t==="d")this.pendingDataMessages.push(s);else throw new Error("Unknown protocol layer: "+t)}upgradeIfSecondaryHealthy_(){this.secondaryResponsesRequired_<=0?(this.log_("Secondary connection is healthy."),this.isHealthy_=!0,this.secondaryConn_.markConnectionHealthy(),this.proceedWithUpgrade_()):(this.log_("sending ping on secondary."),this.secondaryConn_.send({t:"c",d:{t:ps,d:{}}}))}proceedWithUpgrade_(){this.secondaryConn_.start(),this.log_("sending client ack on secondary"),this.secondaryConn_.send({t:"c",d:{t:fs,d:{}}}),this.log_("Ending transmission on primary"),this.conn_.send({t:"c",d:{t:_s,d:{}}}),this.tx_=this.secondaryConn_,this.tryCleanupConnection()}onPrimaryMessageReceived_(e){const t=Le("t",e),s=Le("d",e);t==="c"?this.onControl_(s):t==="d"&&this.onDataMessage_(s)}onDataMessage_(e){this.onPrimaryResponse_(),this.onMessage_(e)}onPrimaryResponse_(){this.isHealthy_||(this.primaryResponsesRequired_--,this.primaryResponsesRequired_<=0&&(this.log_("Primary connection is healthy."),this.isHealthy_=!0,this.conn_.markConnectionHealthy()))}onControl_(e){const t=Le(Kt,e);if(hs in e){const s=e[hs];if(t===fo){const i={...s};this.repoInfo_.isUsingEmulator&&(i.h=this.repoInfo_.host),this.onHandshake_(i)}else if(t===_s){this.log_("recvd end transmission on primary"),this.rx_=this.secondaryConn_;for(let i=0;i<this.pendingDataMessages.length;++i)this.onDataMessage_(this.pendingDataMessages[i]);this.pendingDataMessages=[],this.tryCleanupConnection()}else t===ho?this.onConnectionShutdown_(s):t===us?this.onReset_(s):t===uo?tn("Server Error: "+s):t===ds?(this.log_("got pong on primary."),this.onPrimaryResponse_(),this.sendPingOnPrimaryIfNecessary_()):tn("Unknown control packet command: "+t)}}onHandshake_(e){const t=e.ts,s=e.v,i=e.h;this.sessionId=e.s,this.repoInfo_.host=i,this.state_===0&&(this.conn_.start(),this.onConnectionEstablished_(this.conn_,t),En!==s&&O("Protocol version mismatch detected"),this.tryStartUpgrade_())}tryStartUpgrade_(){const e=this.transportManager_.upgradeTransport();e&&this.startUpgrade_(e)}startUpgrade_(e){this.secondaryConn_=new e(this.nextTransportId_(),this.repoInfo_,this.applicationId_,this.appCheckToken_,this.authToken_,this.sessionId),this.secondaryResponsesRequired_=e.responsesRequiredToBeHealthy||0;const t=this.connReceiver_(this.secondaryConn_),s=this.disconnReceiver_(this.secondaryConn_);this.secondaryConn_.open(t,s),Be(()=>{this.secondaryConn_&&(this.log_("Timed out trying to upgrade."),this.secondaryConn_.close())},Math.floor(oo))}onReset_(e){this.log_("Reset packet received.  New host: "+e),this.repoInfo_.host=e,this.state_===1?this.close():(this.closeConnections_(),this.start_())}onConnectionEstablished_(e,t){this.log_("Realtime connection established."),this.conn_=e,this.state_=1,this.onReady_&&(this.onReady_(t,this.sessionId),this.onReady_=null),this.primaryResponsesRequired_===0?(this.log_("Primary connection is healthy."),this.isHealthy_=!0):Be(()=>{this.sendPingOnPrimaryIfNecessary_()},Math.floor(lo))}sendPingOnPrimaryIfNecessary_(){!this.isHealthy_&&this.state_===1&&(this.log_("sending ping on primary."),this.sendData_({t:"c",d:{t:ps,d:{}}}))}onSecondaryConnectionLost_(){const e=this.secondaryConn_;this.secondaryConn_=null,(this.tx_===e||this.rx_===e)&&this.close()}onConnectionLost_(e){this.conn_=null,!e&&this.state_===0?(this.log_("Realtime connection failed."),this.repoInfo_.isCacheableHost()&&(de.remove("host:"+this.repoInfo_.host),this.repoInfo_.internalHost=this.repoInfo_.host)):this.state_===1&&this.log_("Realtime connection lost."),this.close()}onConnectionShutdown_(e){this.log_("Connection shutdown command received. Shutting down..."),this.onKill_&&(this.onKill_(e),this.onKill_=null),this.onDisconnect_=null,this.close()}sendData_(e){if(this.state_!==1)throw"Connection is not connected";this.tx_.send(e)}close(){this.state_!==2&&(this.log_("Closing realtime connection."),this.state_=2,this.closeConnections_(),this.onDisconnect_&&(this.onDisconnect_(),this.onDisconnect_=null))}closeConnections_(){this.log_("Shutting down all connections"),this.conn_&&(this.conn_.close(),this.conn_=null),this.secondaryConn_&&(this.secondaryConn_.close(),this.secondaryConn_=null),this.healthyTimeout_&&(clearTimeout(this.healthyTimeout_),this.healthyTimeout_=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hi{put(e,t,s,i){}merge(e,t,s,i){}refreshAuthToken(e){}refreshAppCheckToken(e){}onDisconnectPut(e,t,s){}onDisconnectMerge(e,t,s){}onDisconnectCancel(e,t){}reportStats(e){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ui{constructor(e){this.allowedEvents_=e,this.listeners_={},f(Array.isArray(e)&&e.length>0,"Requires a non-empty array")}trigger(e,...t){if(Array.isArray(this.listeners_[e])){const s=[...this.listeners_[e]];for(let i=0;i<s.length;i++)s[i].callback.apply(s[i].context,t)}}on(e,t,s){this.validateEventType_(e),this.listeners_[e]=this.listeners_[e]||[],this.listeners_[e].push({callback:t,context:s});const i=this.getInitialEvent(e);i&&t.apply(s,i)}off(e,t,s){this.validateEventType_(e);const i=this.listeners_[e]||[];for(let r=0;r<i.length;r++)if(i[r].callback===t&&(!s||s===i[r].context)){i.splice(r,1);return}}validateEventType_(e){f(this.allowedEvents_.find(t=>t===e),"Unknown event: "+e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ft extends ui{static getInstance(){return new ft}constructor(){super(["online"]),this.online_=!0,typeof window<"u"&&typeof window.addEventListener<"u"&&!Ws()&&(window.addEventListener("online",()=>{this.online_||(this.online_=!0,this.trigger("online",!0))},!1),window.addEventListener("offline",()=>{this.online_&&(this.online_=!1,this.trigger("online",!1))},!1))}getInitialEvent(e){return f(e==="online","Unknown event type: "+e),[this.online_]}currentlyOnline(){return this.online_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ms=32,gs=768;class E{constructor(e,t){if(t===void 0){this.pieces_=e.split("/");let s=0;for(let i=0;i<this.pieces_.length;i++)this.pieces_[i].length>0&&(this.pieces_[s]=this.pieces_[i],s++);this.pieces_.length=s,this.pieceNum_=0}else this.pieces_=e,this.pieceNum_=t}toString(){let e="";for(let t=this.pieceNum_;t<this.pieces_.length;t++)this.pieces_[t]!==""&&(e+="/"+this.pieces_[t]);return e||"/"}}function C(){return new E("")}function g(n){return n.pieceNum_>=n.pieces_.length?null:n.pieces_[n.pieceNum_]}function oe(n){return n.pieces_.length-n.pieceNum_}function T(n){let e=n.pieceNum_;return e<n.pieces_.length&&e++,new E(n.pieces_,e)}function In(n){return n.pieceNum_<n.pieces_.length?n.pieces_[n.pieces_.length-1]:null}function po(n){let e="";for(let t=n.pieceNum_;t<n.pieces_.length;t++)n.pieces_[t]!==""&&(e+="/"+encodeURIComponent(String(n.pieces_[t])));return e||"/"}function Qe(n,e=0){return n.pieces_.slice(n.pieceNum_+e)}function di(n){if(n.pieceNum_>=n.pieces_.length)return null;const e=[];for(let t=n.pieceNum_;t<n.pieces_.length-1;t++)e.push(n.pieces_[t]);return new E(e,0)}function N(n,e){const t=[];for(let s=n.pieceNum_;s<n.pieces_.length;s++)t.push(n.pieces_[s]);if(e instanceof E)for(let s=e.pieceNum_;s<e.pieces_.length;s++)t.push(e.pieces_[s]);else{const s=e.split("/");for(let i=0;i<s.length;i++)s[i].length>0&&t.push(s[i])}return new E(t,0)}function y(n){return n.pieceNum_>=n.pieces_.length}function M(n,e){const t=g(n),s=g(e);if(t===null)return e;if(t===s)return M(T(n),T(e));throw new Error("INTERNAL ERROR: innerPath ("+e+") is not within outerPath ("+n+")")}function mo(n,e){const t=Qe(n,0),s=Qe(e,0);for(let i=0;i<t.length&&i<s.length;i++){const r=ve(t[i],s[i]);if(r!==0)return r}return t.length===s.length?0:t.length<s.length?-1:1}function Sn(n,e){if(oe(n)!==oe(e))return!1;for(let t=n.pieceNum_,s=e.pieceNum_;t<=n.pieces_.length;t++,s++)if(n.pieces_[t]!==e.pieces_[s])return!1;return!0}function G(n,e){let t=n.pieceNum_,s=e.pieceNum_;if(oe(n)>oe(e))return!1;for(;t<n.pieces_.length;){if(n.pieces_[t]!==e.pieces_[s])return!1;++t,++s}return!0}class go{constructor(e,t){this.errorPrefix_=t,this.parts_=Qe(e,0),this.byteLength_=Math.max(1,this.parts_.length);for(let s=0;s<this.parts_.length;s++)this.byteLength_+=St(this.parts_[s]);fi(this)}}function yo(n,e){n.parts_.length>0&&(n.byteLength_+=1),n.parts_.push(e),n.byteLength_+=St(e),fi(n)}function vo(n){const e=n.parts_.pop();n.byteLength_-=St(e),n.parts_.length>0&&(n.byteLength_-=1)}function fi(n){if(n.byteLength_>gs)throw new Error(n.errorPrefix_+"has a key path longer than "+gs+" bytes ("+n.byteLength_+").");if(n.parts_.length>ms)throw new Error(n.errorPrefix_+"path specified exceeds the maximum depth that can be written ("+ms+") or object contains a cycle "+ue(n))}function ue(n){return n.parts_.length===0?"":"in property '"+n.parts_.join(".")+"'"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nn extends ui{static getInstance(){return new Nn}constructor(){super(["visible"]);let e,t;typeof document<"u"&&typeof document.addEventListener<"u"&&(typeof document.hidden<"u"?(t="visibilitychange",e="hidden"):typeof document.mozHidden<"u"?(t="mozvisibilitychange",e="mozHidden"):typeof document.msHidden<"u"?(t="msvisibilitychange",e="msHidden"):typeof document.webkitHidden<"u"&&(t="webkitvisibilitychange",e="webkitHidden")),this.visible_=!0,t&&document.addEventListener(t,()=>{const s=!document[e];s!==this.visible_&&(this.visible_=s,this.trigger("visible",s))},!1)}getInitialEvent(e){return f(e==="visible","Unknown event type: "+e),[this.visible_]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fe=1e3,Co=300*1e3,ys=30*1e3,Eo=1.3,wo=3e4,To="server_kill",vs=3;class H extends hi{constructor(e,t,s,i,r,o,l,a){if(super(),this.repoInfo_=e,this.applicationId_=t,this.onDataUpdate_=s,this.onConnectStatus_=i,this.onServerInfoUpdate_=r,this.authTokenProvider_=o,this.appCheckTokenProvider_=l,this.authOverride_=a,this.id=H.nextPersistentConnectionId_++,this.log_=Ze("p:"+this.id+":"),this.interruptReasons_={},this.listens=new Map,this.outstandingPuts_=[],this.outstandingGets_=[],this.outstandingPutCount_=0,this.outstandingGetCount_=0,this.onDisconnectRequestQueue_=[],this.connected_=!1,this.reconnectDelay_=Fe,this.maxReconnectDelay_=Co,this.securityDebugCallback_=null,this.lastSessionId=null,this.establishConnectionTimer_=null,this.visible_=!1,this.requestCBHash_={},this.requestNumber_=0,this.realtime_=null,this.authToken_=null,this.appCheckToken_=null,this.forceTokenRefresh_=!1,this.invalidAuthTokenCount_=0,this.invalidAppCheckTokenCount_=0,this.firstConnection_=!0,this.lastConnectionAttemptTime_=null,this.lastConnectionEstablishedTime_=null,a)throw new Error("Auth override specified in options, but not supported on non Node.js platforms");Nn.getInstance().on("visible",this.onVisible_,this),e.host.indexOf("fblocal")===-1&&ft.getInstance().on("online",this.onOnline_,this)}sendRequest(e,t,s){const i=++this.requestNumber_,r={r:i,a:e,b:t};this.log_(b(r)),f(this.connected_,"sendRequest call when we're not connected not allowed."),this.realtime_.sendRequest(r),s&&(this.requestCBHash_[i]=s)}get(e){this.initConnection_();const t=new B,i={action:"g",request:{p:e._path.toString(),q:e._queryObject},onComplete:o=>{const l=o.d;o.s==="ok"?t.resolve(l):t.reject(l)}};this.outstandingGets_.push(i),this.outstandingGetCount_++;const r=this.outstandingGets_.length-1;return this.connected_&&this.sendGet_(r),t.promise}listen(e,t,s,i){this.initConnection_();const r=e._queryIdentifier,o=e._path.toString();this.log_("Listen called for "+o+" "+r),this.listens.has(o)||this.listens.set(o,new Map),f(e._queryParams.isDefault()||!e._queryParams.loadsAllData(),"listen() called for non-default but complete query"),f(!this.listens.get(o).has(r),"listen() called twice for same path/queryId.");const l={onComplete:i,hashFn:t,query:e,tag:s};this.listens.get(o).set(r,l),this.connected_&&this.sendListen_(l)}sendGet_(e){const t=this.outstandingGets_[e];this.sendRequest("g",t.request,s=>{delete this.outstandingGets_[e],this.outstandingGetCount_--,this.outstandingGetCount_===0&&(this.outstandingGets_=[]),t.onComplete&&t.onComplete(s)})}sendListen_(e){const t=e.query,s=t._path.toString(),i=t._queryIdentifier;this.log_("Listen on "+s+" for "+i);const r={p:s},o="q";e.tag&&(r.q=t._queryObject,r.t=e.tag),r.h=e.hashFn(),this.sendRequest(o,r,l=>{const a=l.d,c=l.s;H.warnOnListenWarnings_(a,t),(this.listens.get(s)&&this.listens.get(s).get(i))===e&&(this.log_("listen response",l),c!=="ok"&&this.removeListen_(s,i),e.onComplete&&e.onComplete(c,a))})}static warnOnListenWarnings_(e,t){if(e&&typeof e=="object"&&Y(e,"w")){const s=_e(e,"w");if(Array.isArray(s)&&~s.indexOf("no_index")){const i='".indexOn": "'+t._queryParams.getIndex().toString()+'"',r=t._path.toString();O(`Using an unspecified index. Your data will be downloaded and filtered on the client. Consider adding ${i} at ${r} to your security rules for better performance.`)}}}refreshAuthToken(e){this.authToken_=e,this.log_("Auth token refreshed"),this.authToken_?this.tryAuth():this.connected_&&this.sendRequest("unauth",{},()=>{}),this.reduceReconnectDelayIfAdminCredential_(e)}reduceReconnectDelayIfAdminCredential_(e){(e&&e.length===40||pr(e))&&(this.log_("Admin auth credential detected.  Reducing max reconnect time."),this.maxReconnectDelay_=ys)}refreshAppCheckToken(e){this.appCheckToken_=e,this.log_("App check token refreshed"),this.appCheckToken_?this.tryAppCheck():this.connected_&&this.sendRequest("unappeck",{},()=>{})}tryAuth(){if(this.connected_&&this.authToken_){const e=this.authToken_,t=mr(e)?"auth":"gauth",s={cred:e};this.authOverride_===null?s.noauth=!0:typeof this.authOverride_=="object"&&(s.authvar=this.authOverride_),this.sendRequest(t,s,i=>{const r=i.s,o=i.d||"error";this.authToken_===e&&(r==="ok"?this.invalidAuthTokenCount_=0:this.onAuthRevoked_(r,o))})}}tryAppCheck(){this.connected_&&this.appCheckToken_&&this.sendRequest("appcheck",{token:this.appCheckToken_},e=>{const t=e.s,s=e.d||"error";t==="ok"?this.invalidAppCheckTokenCount_=0:this.onAppCheckRevoked_(t,s)})}unlisten(e,t){const s=e._path.toString(),i=e._queryIdentifier;this.log_("Unlisten called for "+s+" "+i),f(e._queryParams.isDefault()||!e._queryParams.loadsAllData(),"unlisten() called for non-default but complete query"),this.removeListen_(s,i)&&this.connected_&&this.sendUnlisten_(s,i,e._queryObject,t)}sendUnlisten_(e,t,s,i){this.log_("Unlisten on "+e+" for "+t);const r={p:e},o="n";i&&(r.q=s,r.t=i),this.sendRequest(o,r)}onDisconnectPut(e,t,s){this.initConnection_(),this.connected_?this.sendOnDisconnect_("o",e,t,s):this.onDisconnectRequestQueue_.push({pathString:e,action:"o",data:t,onComplete:s})}onDisconnectMerge(e,t,s){this.initConnection_(),this.connected_?this.sendOnDisconnect_("om",e,t,s):this.onDisconnectRequestQueue_.push({pathString:e,action:"om",data:t,onComplete:s})}onDisconnectCancel(e,t){this.initConnection_(),this.connected_?this.sendOnDisconnect_("oc",e,null,t):this.onDisconnectRequestQueue_.push({pathString:e,action:"oc",data:null,onComplete:t})}sendOnDisconnect_(e,t,s,i){const r={p:t,d:s};this.log_("onDisconnect "+e,r),this.sendRequest(e,r,o=>{i&&setTimeout(()=>{i(o.s,o.d)},Math.floor(0))})}put(e,t,s,i){this.putInternal("p",e,t,s,i)}merge(e,t,s,i){this.putInternal("m",e,t,s,i)}putInternal(e,t,s,i,r){this.initConnection_();const o={p:t,d:s};r!==void 0&&(o.h=r),this.outstandingPuts_.push({action:e,request:o,onComplete:i}),this.outstandingPutCount_++;const l=this.outstandingPuts_.length-1;this.connected_?this.sendPut_(l):this.log_("Buffering put: "+t)}sendPut_(e){const t=this.outstandingPuts_[e].action,s=this.outstandingPuts_[e].request,i=this.outstandingPuts_[e].onComplete;this.outstandingPuts_[e].queued=this.connected_,this.sendRequest(t,s,r=>{this.log_(t+" response",r),delete this.outstandingPuts_[e],this.outstandingPutCount_--,this.outstandingPutCount_===0&&(this.outstandingPuts_=[]),i&&i(r.s,r.d)})}reportStats(e){if(this.connected_){const t={c:e};this.log_("reportStats",t),this.sendRequest("s",t,s=>{if(s.s!=="ok"){const r=s.d;this.log_("reportStats","Error sending stats: "+r)}})}}onDataMessage_(e){if("r"in e){this.log_("from server: "+b(e));const t=e.r,s=this.requestCBHash_[t];s&&(delete this.requestCBHash_[t],s(e.b))}else{if("error"in e)throw"A server-side error has occurred: "+e.error;"a"in e&&this.onDataPush_(e.a,e.b)}}onDataPush_(e,t){this.log_("handleServerMessage",e,t),e==="d"?this.onDataUpdate_(t.p,t.d,!1,t.t):e==="m"?this.onDataUpdate_(t.p,t.d,!0,t.t):e==="c"?this.onListenRevoked_(t.p,t.q):e==="ac"?this.onAuthRevoked_(t.s,t.d):e==="apc"?this.onAppCheckRevoked_(t.s,t.d):e==="sd"?this.onSecurityDebugPacket_(t):tn("Unrecognized action received from server: "+b(e)+`
Are you using the latest client?`)}onReady_(e,t){this.log_("connection ready"),this.connected_=!0,this.lastConnectionEstablishedTime_=new Date().getTime(),this.handleTimestamp_(e),this.lastSessionId=t,this.firstConnection_&&this.sendConnectStats_(),this.restoreState_(),this.firstConnection_=!1,this.onConnectStatus_(!0)}scheduleConnect_(e){f(!this.realtime_,"Scheduling a connect when we're already connected/ing?"),this.establishConnectionTimer_&&clearTimeout(this.establishConnectionTimer_),this.establishConnectionTimer_=setTimeout(()=>{this.establishConnectionTimer_=null,this.establishConnection_()},Math.floor(e))}initConnection_(){!this.realtime_&&this.firstConnection_&&this.scheduleConnect_(0)}onVisible_(e){e&&!this.visible_&&this.reconnectDelay_===this.maxReconnectDelay_&&(this.log_("Window became visible.  Reducing delay."),this.reconnectDelay_=Fe,this.realtime_||this.scheduleConnect_(0)),this.visible_=e}onOnline_(e){e?(this.log_("Browser went online."),this.reconnectDelay_=Fe,this.realtime_||this.scheduleConnect_(0)):(this.log_("Browser went offline.  Killing connection."),this.realtime_&&this.realtime_.close())}onRealtimeDisconnect_(){if(this.log_("data client disconnected"),this.connected_=!1,this.realtime_=null,this.cancelSentTransactions_(),this.requestCBHash_={},this.shouldReconnect_()){this.visible_?this.lastConnectionEstablishedTime_&&(new Date().getTime()-this.lastConnectionEstablishedTime_>wo&&(this.reconnectDelay_=Fe),this.lastConnectionEstablishedTime_=null):(this.log_("Window isn't visible.  Delaying reconnect."),this.reconnectDelay_=this.maxReconnectDelay_,this.lastConnectionAttemptTime_=new Date().getTime());const e=Math.max(0,new Date().getTime()-this.lastConnectionAttemptTime_);let t=Math.max(0,this.reconnectDelay_-e);t=Math.random()*t,this.log_("Trying to reconnect in "+t+"ms"),this.scheduleConnect_(t),this.reconnectDelay_=Math.min(this.maxReconnectDelay_,this.reconnectDelay_*Eo)}this.onConnectStatus_(!1)}async establishConnection_(){if(this.shouldReconnect_()){this.log_("Making a connection attempt"),this.lastConnectionAttemptTime_=new Date().getTime(),this.lastConnectionEstablishedTime_=null;const e=this.onDataMessage_.bind(this),t=this.onReady_.bind(this),s=this.onRealtimeDisconnect_.bind(this),i=this.id+":"+H.nextConnectionId_++,r=this.lastSessionId;let o=!1,l=null;const a=function(){l?l.close():(o=!0,s())},c=function(u){f(l,"sendRequest call when we're not connected not allowed."),l.sendRequest(u)};this.realtime_={close:a,sendRequest:c};const h=this.forceTokenRefresh_;this.forceTokenRefresh_=!1;try{const[u,d]=await Promise.all([this.authTokenProvider_.getToken(h),this.appCheckTokenProvider_.getToken(h)]);o?x("getToken() completed but was canceled"):(x("getToken() completed. Creating connection."),this.authToken_=u&&u.accessToken,this.appCheckToken_=d&&d.token,l=new _o(i,this.repoInfo_,this.applicationId_,this.appCheckToken_,this.authToken_,e,t,s,_=>{O(_+" ("+this.repoInfo_.toString()+")"),this.interrupt(To)},r))}catch(u){this.log_("Failed to get token: "+u),o||(this.repoInfo_.nodeAdmin&&O(u),a())}}}interrupt(e){x("Interrupting connection for reason: "+e),this.interruptReasons_[e]=!0,this.realtime_?this.realtime_.close():(this.establishConnectionTimer_&&(clearTimeout(this.establishConnectionTimer_),this.establishConnectionTimer_=null),this.connected_&&this.onRealtimeDisconnect_())}resume(e){x("Resuming connection for reason: "+e),delete this.interruptReasons_[e],Zt(this.interruptReasons_)&&(this.reconnectDelay_=Fe,this.realtime_||this.scheduleConnect_(0))}handleTimestamp_(e){const t=e-new Date().getTime();this.onServerInfoUpdate_({serverTimeOffset:t})}cancelSentTransactions_(){for(let e=0;e<this.outstandingPuts_.length;e++){const t=this.outstandingPuts_[e];t&&"h"in t.request&&t.queued&&(t.onComplete&&t.onComplete("disconnect"),delete this.outstandingPuts_[e],this.outstandingPutCount_--)}this.outstandingPutCount_===0&&(this.outstandingPuts_=[])}onListenRevoked_(e,t){let s;t?s=t.map(r=>Cn(r)).join("$"):s="default";const i=this.removeListen_(e,s);i&&i.onComplete&&i.onComplete("permission_denied")}removeListen_(e,t){const s=new E(e).toString();let i;if(this.listens.has(s)){const r=this.listens.get(s);i=r.get(t),r.delete(t),r.size===0&&this.listens.delete(s)}else i=void 0;return i}onAuthRevoked_(e,t){x("Auth token revoked: "+e+"/"+t),this.authToken_=null,this.forceTokenRefresh_=!0,this.realtime_.close(),(e==="invalid_token"||e==="permission_denied")&&(this.invalidAuthTokenCount_++,this.invalidAuthTokenCount_>=vs&&(this.reconnectDelay_=ys,this.authTokenProvider_.notifyForInvalidToken()))}onAppCheckRevoked_(e,t){x("App check token revoked: "+e+"/"+t),this.appCheckToken_=null,this.forceTokenRefresh_=!0,(e==="invalid_token"||e==="permission_denied")&&(this.invalidAppCheckTokenCount_++,this.invalidAppCheckTokenCount_>=vs&&this.appCheckTokenProvider_.notifyForInvalidToken())}onSecurityDebugPacket_(e){this.securityDebugCallback_?this.securityDebugCallback_(e):"msg"in e&&console.log("FIREBASE: "+e.msg.replace(`
`,`
FIREBASE: `))}restoreState_(){this.tryAuth(),this.tryAppCheck();for(const e of this.listens.values())for(const t of e.values())this.sendListen_(t);for(let e=0;e<this.outstandingPuts_.length;e++)this.outstandingPuts_[e]&&this.sendPut_(e);for(;this.onDisconnectRequestQueue_.length;){const e=this.onDisconnectRequestQueue_.shift();this.sendOnDisconnect_(e.action,e.pathString,e.data,e.onComplete)}for(let e=0;e<this.outstandingGets_.length;e++)this.outstandingGets_[e]&&this.sendGet_(e)}sendConnectStats_(){const e={};let t="js";e["sdk."+t+"."+Bs.replace(/\./g,"-")]=1,Ws()?e["framework.cordova"]=1:gr()&&(e["framework.reactnative"]=1),this.reportStats(e)}shouldReconnect_(){const e=ft.getInstance().currentlyOnline();return Zt(this.interruptReasons_)&&e}}H.nextPersistentConnectionId_=0;H.nextConnectionId_=0;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class v{constructor(e,t){this.name=e,this.node=t}static Wrap(e,t){return new v(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rt{getCompare(){return this.compare.bind(this)}indexedValueChanged(e,t){const s=new v(re,e),i=new v(re,t);return this.compare(s,i)!==0}minPost(){return v.MIN}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let ct;class _i extends Rt{static get __EMPTY_NODE(){return ct}static set __EMPTY_NODE(e){ct=e}compare(e,t){return ve(e.name,t.name)}isDefinedOn(e){throw Xe("KeyIndex.isDefinedOn not expected to be called.")}indexedValueChanged(e,t){return!1}minPost(){return v.MIN}maxPost(){return new v(ee,ct)}makePost(e,t){return f(typeof e=="string","KeyIndex indexValue must always be a string."),new v(e,ct)}toString(){return".key"}}const $=new _i;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ht{constructor(e,t,s,i,r=null){this.isReverse_=i,this.resultGenerator_=r,this.nodeStack_=[];let o=1;for(;!e.isEmpty();)if(e=e,o=t?s(e.key,t):1,i&&(o*=-1),o<0)this.isReverse_?e=e.left:e=e.right;else if(o===0){this.nodeStack_.push(e);break}else this.nodeStack_.push(e),this.isReverse_?e=e.right:e=e.left}getNext(){if(this.nodeStack_.length===0)return null;let e=this.nodeStack_.pop(),t;if(this.resultGenerator_?t=this.resultGenerator_(e.key,e.value):t={key:e.key,value:e.value},this.isReverse_)for(e=e.left;!e.isEmpty();)this.nodeStack_.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack_.push(e),e=e.left;return t}hasNext(){return this.nodeStack_.length>0}peek(){if(this.nodeStack_.length===0)return null;const e=this.nodeStack_[this.nodeStack_.length-1];return this.resultGenerator_?this.resultGenerator_(e.key,e.value):{key:e.key,value:e.value}}}class P{constructor(e,t,s,i,r){this.key=e,this.value=t,this.color=s??P.RED,this.left=i??L.EMPTY_NODE,this.right=r??L.EMPTY_NODE}copy(e,t,s,i,r){return new P(e??this.key,t??this.value,s??this.color,i??this.left,r??this.right)}count(){return this.left.count()+1+this.right.count()}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||!!e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min_(){return this.left.isEmpty()?this:this.left.min_()}minKey(){return this.min_().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,s){let i=this;const r=s(e,i.key);return r<0?i=i.copy(null,null,null,i.left.insert(e,t,s),null):r===0?i=i.copy(null,t,null,null,null):i=i.copy(null,null,null,null,i.right.insert(e,t,s)),i.fixUp_()}removeMin_(){if(this.left.isEmpty())return L.EMPTY_NODE;let e=this;return!e.left.isRed_()&&!e.left.left.isRed_()&&(e=e.moveRedLeft_()),e=e.copy(null,null,null,e.left.removeMin_(),null),e.fixUp_()}remove(e,t){let s,i;if(s=this,t(e,s.key)<0)!s.left.isEmpty()&&!s.left.isRed_()&&!s.left.left.isRed_()&&(s=s.moveRedLeft_()),s=s.copy(null,null,null,s.left.remove(e,t),null);else{if(s.left.isRed_()&&(s=s.rotateRight_()),!s.right.isEmpty()&&!s.right.isRed_()&&!s.right.left.isRed_()&&(s=s.moveRedRight_()),t(e,s.key)===0){if(s.right.isEmpty())return L.EMPTY_NODE;i=s.right.min_(),s=s.copy(i.key,i.value,null,null,s.right.removeMin_())}s=s.copy(null,null,null,null,s.right.remove(e,t))}return s.fixUp_()}isRed_(){return this.color}fixUp_(){let e=this;return e.right.isRed_()&&!e.left.isRed_()&&(e=e.rotateLeft_()),e.left.isRed_()&&e.left.left.isRed_()&&(e=e.rotateRight_()),e.left.isRed_()&&e.right.isRed_()&&(e=e.colorFlip_()),e}moveRedLeft_(){let e=this.colorFlip_();return e.right.left.isRed_()&&(e=e.copy(null,null,null,null,e.right.rotateRight_()),e=e.rotateLeft_(),e=e.colorFlip_()),e}moveRedRight_(){let e=this.colorFlip_();return e.left.left.isRed_()&&(e=e.rotateRight_(),e=e.colorFlip_()),e}rotateLeft_(){const e=this.copy(null,null,P.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight_(){const e=this.copy(null,null,P.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip_(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth_(){const e=this.check_();return Math.pow(2,e)<=this.count()+1}check_(){if(this.isRed_()&&this.left.isRed_())throw new Error("Red node has red child("+this.key+","+this.value+")");if(this.right.isRed_())throw new Error("Right child of ("+this.key+","+this.value+") is red");const e=this.left.check_();if(e!==this.right.check_())throw new Error("Black depths differ");return e+(this.isRed_()?0:1)}}P.RED=!0;P.BLACK=!1;class Io{copy(e,t,s,i,r){return this}insert(e,t,s){return new P(e,t,null)}remove(e,t){return this}count(){return 0}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}check_(){return 0}isRed_(){return!1}}class L{constructor(e,t=L.EMPTY_NODE){this.comparator_=e,this.root_=t}insert(e,t){return new L(this.comparator_,this.root_.insert(e,t,this.comparator_).copy(null,null,P.BLACK,null,null))}remove(e){return new L(this.comparator_,this.root_.remove(e,this.comparator_).copy(null,null,P.BLACK,null,null))}get(e){let t,s=this.root_;for(;!s.isEmpty();){if(t=this.comparator_(e,s.key),t===0)return s.value;t<0?s=s.left:t>0&&(s=s.right)}return null}getPredecessorKey(e){let t,s=this.root_,i=null;for(;!s.isEmpty();)if(t=this.comparator_(e,s.key),t===0){if(s.left.isEmpty())return i?i.key:null;for(s=s.left;!s.right.isEmpty();)s=s.right;return s.key}else t<0?s=s.left:t>0&&(i=s,s=s.right);throw new Error("Attempted to find predecessor key for a nonexistent key.  What gives?")}isEmpty(){return this.root_.isEmpty()}count(){return this.root_.count()}minKey(){return this.root_.minKey()}maxKey(){return this.root_.maxKey()}inorderTraversal(e){return this.root_.inorderTraversal(e)}reverseTraversal(e){return this.root_.reverseTraversal(e)}getIterator(e){return new ht(this.root_,null,this.comparator_,!1,e)}getIteratorFrom(e,t){return new ht(this.root_,e,this.comparator_,!1,t)}getReverseIteratorFrom(e,t){return new ht(this.root_,e,this.comparator_,!0,t)}getReverseIterator(e){return new ht(this.root_,null,this.comparator_,!0,e)}}L.EMPTY_NODE=new Io;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function So(n,e){return ve(n.name,e.name)}function Rn(n,e){return ve(n,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let sn;function No(n){sn=n}const pi=function(n){return typeof n=="number"?"number:"+Ks(n):"string:"+n},mi=function(n){if(n.isLeafNode()){const e=n.val();f(typeof e=="string"||typeof e=="number"||typeof e=="object"&&Y(e,".sv"),"Priority must be a string or number.")}else f(n===sn||n.isEmpty(),"priority of unexpected type.");f(n===sn||n.getPriority().isEmpty(),"Priority nodes can't have a priority of their own.")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Cs;class k{static set __childrenNodeConstructor(e){Cs=e}static get __childrenNodeConstructor(){return Cs}constructor(e,t=k.__childrenNodeConstructor.EMPTY_NODE){this.value_=e,this.priorityNode_=t,this.lazyHash_=null,f(this.value_!==void 0&&this.value_!==null,"LeafNode shouldn't be created with null/undefined value."),mi(this.priorityNode_)}isLeafNode(){return!0}getPriority(){return this.priorityNode_}updatePriority(e){return new k(this.value_,e)}getImmediateChild(e){return e===".priority"?this.priorityNode_:k.__childrenNodeConstructor.EMPTY_NODE}getChild(e){return y(e)?this:g(e)===".priority"?this.priorityNode_:k.__childrenNodeConstructor.EMPTY_NODE}hasChild(){return!1}getPredecessorChildName(e,t){return null}updateImmediateChild(e,t){return e===".priority"?this.updatePriority(t):t.isEmpty()&&e!==".priority"?this:k.__childrenNodeConstructor.EMPTY_NODE.updateImmediateChild(e,t).updatePriority(this.priorityNode_)}updateChild(e,t){const s=g(e);return s===null?t:t.isEmpty()&&s!==".priority"?this:(f(s!==".priority"||oe(e)===1,".priority must be the last token in a path"),this.updateImmediateChild(s,k.__childrenNodeConstructor.EMPTY_NODE.updateChild(T(e),t)))}isEmpty(){return!1}numChildren(){return 0}forEachChild(e,t){return!1}val(e){return e&&!this.getPriority().isEmpty()?{".value":this.getValue(),".priority":this.getPriority().val()}:this.getValue()}hash(){if(this.lazyHash_===null){let e="";this.priorityNode_.isEmpty()||(e+="priority:"+pi(this.priorityNode_.val())+":");const t=typeof this.value_;e+=t+":",t==="number"?e+=Ks(this.value_):e+=this.value_,this.lazyHash_=Qs(e)}return this.lazyHash_}getValue(){return this.value_}compareTo(e){return e===k.__childrenNodeConstructor.EMPTY_NODE?1:e instanceof k.__childrenNodeConstructor?-1:(f(e.isLeafNode(),"Unknown node type"),this.compareToLeafNode_(e))}compareToLeafNode_(e){const t=typeof e.value_,s=typeof this.value_,i=k.VALUE_TYPE_ORDER.indexOf(t),r=k.VALUE_TYPE_ORDER.indexOf(s);return f(i>=0,"Unknown leaf type: "+t),f(r>=0,"Unknown leaf type: "+s),i===r?s==="object"?0:this.value_<e.value_?-1:this.value_===e.value_?0:1:r-i}withIndex(){return this}isIndexed(){return!0}equals(e){if(e===this)return!0;if(e.isLeafNode()){const t=e;return this.value_===t.value_&&this.priorityNode_.equals(t.priorityNode_)}else return!1}}k.VALUE_TYPE_ORDER=["object","boolean","number","string"];/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let gi,yi;function Ro(n){gi=n}function bo(n){yi=n}class ko extends Rt{compare(e,t){const s=e.node.getPriority(),i=t.node.getPriority(),r=s.compareTo(i);return r===0?ve(e.name,t.name):r}isDefinedOn(e){return!e.getPriority().isEmpty()}indexedValueChanged(e,t){return!e.getPriority().equals(t.getPriority())}minPost(){return v.MIN}maxPost(){return new v(ee,new k("[PRIORITY-POST]",yi))}makePost(e,t){const s=gi(e);return new v(t,new k("[PRIORITY-POST]",s))}toString(){return".priority"}}const S=new ko;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Po=Math.log(2);class xo{constructor(e){const t=r=>parseInt(Math.log(r)/Po,10),s=r=>parseInt(Array(r+1).join("1"),2);this.count=t(e+1),this.current_=this.count-1;const i=s(this.count);this.bits_=e+1&i}nextBitIsOne(){const e=!(this.bits_&1<<this.current_);return this.current_--,e}}const _t=function(n,e,t,s){n.sort(e);const i=function(a,c){const h=c-a;let u,d;if(h===0)return null;if(h===1)return u=n[a],d=t?t(u):u,new P(d,u.node,P.BLACK,null,null);{const _=parseInt(h/2,10)+a,p=i(a,_),w=i(_+1,c);return u=n[_],d=t?t(u):u,new P(d,u.node,P.BLACK,p,w)}},r=function(a){let c=null,h=null,u=n.length;const d=function(p,w){const D=u-p,we=u;u-=p;const at=i(D+1,we),Qt=n[D],or=t?t(Qt):Qt;_(new P(or,Qt.node,w,null,at))},_=function(p){c?(c.left=p,c=p):(h=p,c=p)};for(let p=0;p<a.count;++p){const w=a.nextBitIsOne(),D=Math.pow(2,a.count-(p+1));w?d(D,P.BLACK):(d(D,P.BLACK),d(D,P.RED))}return h},o=new xo(n.length),l=r(o);return new L(s||e,l)};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let zt;const Te={};class Z{static get Default(){return f(Te&&S,"ChildrenNode.ts has not been loaded"),zt=zt||new Z({".priority":Te},{".priority":S}),zt}constructor(e,t){this.indexes_=e,this.indexSet_=t}get(e){const t=_e(this.indexes_,e);if(!t)throw new Error("No index defined for "+e);return t instanceof L?t:null}hasIndex(e){return Y(this.indexSet_,e.toString())}addIndex(e,t){f(e!==$,"KeyIndex always exists and isn't meant to be added to the IndexMap.");const s=[];let i=!1;const r=t.getIterator(v.Wrap);let o=r.getNext();for(;o;)i=i||e.isDefinedOn(o.node),s.push(o),o=r.getNext();let l;i?l=_t(s,e.getCompare()):l=Te;const a=e.toString(),c={...this.indexSet_};c[a]=e;const h={...this.indexes_};return h[a]=l,new Z(h,c)}addToIndexes(e,t){const s=ut(this.indexes_,(i,r)=>{const o=_e(this.indexSet_,r);if(f(o,"Missing index implementation for "+r),i===Te)if(o.isDefinedOn(e.node)){const l=[],a=t.getIterator(v.Wrap);let c=a.getNext();for(;c;)c.name!==e.name&&l.push(c),c=a.getNext();return l.push(e),_t(l,o.getCompare())}else return Te;else{const l=t.get(e.name);let a=i;return l&&(a=a.remove(new v(e.name,l))),a.insert(e,e.node)}});return new Z(s,this.indexSet_)}removeFromIndexes(e,t){const s=ut(this.indexes_,i=>{if(i===Te)return i;{const r=t.get(e.name);return r?i.remove(new v(e.name,r)):i}});return new Z(s,this.indexSet_)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let We;class m{static get EMPTY_NODE(){return We||(We=new m(new L(Rn),null,Z.Default))}constructor(e,t,s){this.children_=e,this.priorityNode_=t,this.indexMap_=s,this.lazyHash_=null,this.priorityNode_&&mi(this.priorityNode_),this.children_.isEmpty()&&f(!this.priorityNode_||this.priorityNode_.isEmpty(),"An empty node cannot have a priority")}isLeafNode(){return!1}getPriority(){return this.priorityNode_||We}updatePriority(e){return this.children_.isEmpty()?this:new m(this.children_,e,this.indexMap_)}getImmediateChild(e){if(e===".priority")return this.getPriority();{const t=this.children_.get(e);return t===null?We:t}}getChild(e){const t=g(e);return t===null?this:this.getImmediateChild(t).getChild(T(e))}hasChild(e){return this.children_.get(e)!==null}updateImmediateChild(e,t){if(f(t,"We should always be passing snapshot nodes"),e===".priority")return this.updatePriority(t);{const s=new v(e,t);let i,r;t.isEmpty()?(i=this.children_.remove(e),r=this.indexMap_.removeFromIndexes(s,this.children_)):(i=this.children_.insert(e,t),r=this.indexMap_.addToIndexes(s,this.children_));const o=i.isEmpty()?We:this.priorityNode_;return new m(i,o,r)}}updateChild(e,t){const s=g(e);if(s===null)return t;{f(g(e)!==".priority"||oe(e)===1,".priority must be the last token in a path");const i=this.getImmediateChild(s).updateChild(T(e),t);return this.updateImmediateChild(s,i)}}isEmpty(){return this.children_.isEmpty()}numChildren(){return this.children_.count()}val(e){if(this.isEmpty())return null;const t={};let s=0,i=0,r=!0;if(this.forEachChild(S,(o,l)=>{t[o]=l.val(e),s++,r&&m.INTEGER_REGEXP_.test(o)?i=Math.max(i,Number(o)):r=!1}),!e&&r&&i<2*s){const o=[];for(const l in t)o[l]=t[l];return o}else return e&&!this.getPriority().isEmpty()&&(t[".priority"]=this.getPriority().val()),t}hash(){if(this.lazyHash_===null){let e="";this.getPriority().isEmpty()||(e+="priority:"+pi(this.getPriority().val())+":"),this.forEachChild(S,(t,s)=>{const i=s.hash();i!==""&&(e+=":"+t+":"+i)}),this.lazyHash_=e===""?"":Qs(e)}return this.lazyHash_}getPredecessorChildName(e,t,s){const i=this.resolveIndex_(s);if(i){const r=i.getPredecessorKey(new v(e,t));return r?r.name:null}else return this.children_.getPredecessorKey(e)}getFirstChildName(e){const t=this.resolveIndex_(e);if(t){const s=t.minKey();return s&&s.name}else return this.children_.minKey()}getFirstChild(e){const t=this.getFirstChildName(e);return t?new v(t,this.children_.get(t)):null}getLastChildName(e){const t=this.resolveIndex_(e);if(t){const s=t.maxKey();return s&&s.name}else return this.children_.maxKey()}getLastChild(e){const t=this.getLastChildName(e);return t?new v(t,this.children_.get(t)):null}forEachChild(e,t){const s=this.resolveIndex_(e);return s?s.inorderTraversal(i=>t(i.name,i.node)):this.children_.inorderTraversal(t)}getIterator(e){return this.getIteratorFrom(e.minPost(),e)}getIteratorFrom(e,t){const s=this.resolveIndex_(t);if(s)return s.getIteratorFrom(e,i=>i);{const i=this.children_.getIteratorFrom(e.name,v.Wrap);let r=i.peek();for(;r!=null&&t.compare(r,e)<0;)i.getNext(),r=i.peek();return i}}getReverseIterator(e){return this.getReverseIteratorFrom(e.maxPost(),e)}getReverseIteratorFrom(e,t){const s=this.resolveIndex_(t);if(s)return s.getReverseIteratorFrom(e,i=>i);{const i=this.children_.getReverseIteratorFrom(e.name,v.Wrap);let r=i.peek();for(;r!=null&&t.compare(r,e)>0;)i.getNext(),r=i.peek();return i}}compareTo(e){return this.isEmpty()?e.isEmpty()?0:-1:e.isLeafNode()||e.isEmpty()?1:e===et?-1:0}withIndex(e){if(e===$||this.indexMap_.hasIndex(e))return this;{const t=this.indexMap_.addIndex(e,this.children_);return new m(this.children_,this.priorityNode_,t)}}isIndexed(e){return e===$||this.indexMap_.hasIndex(e)}equals(e){if(e===this)return!0;if(e.isLeafNode())return!1;{const t=e;if(this.getPriority().equals(t.getPriority()))if(this.children_.count()===t.children_.count()){const s=this.getIterator(S),i=t.getIterator(S);let r=s.getNext(),o=i.getNext();for(;r&&o;){if(r.name!==o.name||!r.node.equals(o.node))return!1;r=s.getNext(),o=i.getNext()}return r===null&&o===null}else return!1;else return!1}}resolveIndex_(e){return e===$?null:this.indexMap_.get(e.toString())}}m.INTEGER_REGEXP_=/^(0|[1-9]\d*)$/;class Ao extends m{constructor(){super(new L(Rn),m.EMPTY_NODE,Z.Default)}compareTo(e){return e===this?0:1}equals(e){return e===this}getPriority(){return this}getImmediateChild(e){return m.EMPTY_NODE}isEmpty(){return!1}}const et=new Ao;Object.defineProperties(v,{MIN:{value:new v(re,m.EMPTY_NODE)},MAX:{value:new v(ee,et)}});_i.__EMPTY_NODE=m.EMPTY_NODE;k.__childrenNodeConstructor=m;No(et);bo(et);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Do=!0;function R(n,e=null){if(n===null)return m.EMPTY_NODE;if(typeof n=="object"&&".priority"in n&&(e=n[".priority"]),f(e===null||typeof e=="string"||typeof e=="number"||typeof e=="object"&&".sv"in e,"Invalid priority type found: "+typeof e),typeof n=="object"&&".value"in n&&n[".value"]!==null&&(n=n[".value"]),typeof n!="object"||".sv"in n){const t=n;return new k(t,R(e))}if(!(n instanceof Array)&&Do){const t=[];let s=!1;if(A(n,(o,l)=>{if(o.substring(0,1)!=="."){const a=R(l);a.isEmpty()||(s=s||!a.getPriority().isEmpty(),t.push(new v(o,a)))}}),t.length===0)return m.EMPTY_NODE;const r=_t(t,So,o=>o.name,Rn);if(s){const o=_t(t,S.getCompare());return new m(r,R(e),new Z({".priority":o},{".priority":S}))}else return new m(r,R(e),Z.Default)}else{let t=m.EMPTY_NODE;return A(n,(s,i)=>{if(Y(n,s)&&s.substring(0,1)!=="."){const r=R(i);(r.isLeafNode()||!r.isEmpty())&&(t=t.updateImmediateChild(s,r))}}),t.updatePriority(R(e))}}Ro(R);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bn extends Rt{constructor(e){super(),this.indexPath_=e,f(!y(e)&&g(e)!==".priority","Can't create PathIndex with empty path or .priority key")}extractChild(e){return e.getChild(this.indexPath_)}isDefinedOn(e){return!e.getChild(this.indexPath_).isEmpty()}compare(e,t){const s=this.extractChild(e.node),i=this.extractChild(t.node),r=s.compareTo(i);return r===0?ve(e.name,t.name):r}makePost(e,t){const s=R(e),i=m.EMPTY_NODE.updateChild(this.indexPath_,s);return new v(t,i)}maxPost(){const e=m.EMPTY_NODE.updateChild(this.indexPath_,et);return new v(ee,e)}toString(){return Qe(this.indexPath_,0).join("/")}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Oo extends Rt{compare(e,t){const s=e.node.compareTo(t.node);return s===0?ve(e.name,t.name):s}isDefinedOn(e){return!0}indexedValueChanged(e,t){return!e.equals(t)}minPost(){return v.MIN}maxPost(){return v.MAX}makePost(e,t){const s=R(e);return new v(t,s)}toString(){return".value"}}const kn=new Oo;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vi(n){return{type:"value",snapshotNode:n}}function Re(n,e){return{type:"child_added",snapshotNode:e,childName:n}}function qe(n,e){return{type:"child_removed",snapshotNode:e,childName:n}}function Ye(n,e,t){return{type:"child_changed",snapshotNode:e,childName:n,oldSnap:t}}function Mo(n,e){return{type:"child_moved",snapshotNode:e,childName:n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pn{constructor(e){this.index_=e}updateChild(e,t,s,i,r,o){f(e.isIndexed(this.index_),"A node must be indexed if only a child is updated");const l=e.getImmediateChild(t);return l.getChild(i).equals(s.getChild(i))&&l.isEmpty()===s.isEmpty()||(o!=null&&(s.isEmpty()?e.hasChild(t)?o.trackChildChange(qe(t,l)):f(e.isLeafNode(),"A child remove without an old child only makes sense on a leaf node"):l.isEmpty()?o.trackChildChange(Re(t,s)):o.trackChildChange(Ye(t,s,l))),e.isLeafNode()&&s.isEmpty())?e:e.updateImmediateChild(t,s).withIndex(this.index_)}updateFullNode(e,t,s){return s!=null&&(e.isLeafNode()||e.forEachChild(S,(i,r)=>{t.hasChild(i)||s.trackChildChange(qe(i,r))}),t.isLeafNode()||t.forEachChild(S,(i,r)=>{if(e.hasChild(i)){const o=e.getImmediateChild(i);o.equals(r)||s.trackChildChange(Ye(i,r,o))}else s.trackChildChange(Re(i,r))})),t.withIndex(this.index_)}updatePriority(e,t){return e.isEmpty()?m.EMPTY_NODE:e.updatePriority(t)}filtersNodes(){return!1}getIndexedFilter(){return this}getIndex(){return this.index_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ke{constructor(e){this.indexedFilter_=new Pn(e.getIndex()),this.index_=e.getIndex(),this.startPost_=Ke.getStartPost_(e),this.endPost_=Ke.getEndPost_(e),this.startIsInclusive_=!e.startAfterSet_,this.endIsInclusive_=!e.endBeforeSet_}getStartPost(){return this.startPost_}getEndPost(){return this.endPost_}matches(e){const t=this.startIsInclusive_?this.index_.compare(this.getStartPost(),e)<=0:this.index_.compare(this.getStartPost(),e)<0,s=this.endIsInclusive_?this.index_.compare(e,this.getEndPost())<=0:this.index_.compare(e,this.getEndPost())<0;return t&&s}updateChild(e,t,s,i,r,o){return this.matches(new v(t,s))||(s=m.EMPTY_NODE),this.indexedFilter_.updateChild(e,t,s,i,r,o)}updateFullNode(e,t,s){t.isLeafNode()&&(t=m.EMPTY_NODE);let i=t.withIndex(this.index_);i=i.updatePriority(m.EMPTY_NODE);const r=this;return t.forEachChild(S,(o,l)=>{r.matches(new v(o,l))||(i=i.updateImmediateChild(o,m.EMPTY_NODE))}),this.indexedFilter_.updateFullNode(e,i,s)}updatePriority(e,t){return e}filtersNodes(){return!0}getIndexedFilter(){return this.indexedFilter_}getIndex(){return this.index_}static getStartPost_(e){if(e.hasStart()){const t=e.getIndexStartName();return e.getIndex().makePost(e.getIndexStartValue(),t)}else return e.getIndex().minPost()}static getEndPost_(e){if(e.hasEnd()){const t=e.getIndexEndName();return e.getIndex().makePost(e.getIndexEndValue(),t)}else return e.getIndex().maxPost()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Lo{constructor(e){this.withinDirectionalStart=t=>this.reverse_?this.withinEndPost(t):this.withinStartPost(t),this.withinDirectionalEnd=t=>this.reverse_?this.withinStartPost(t):this.withinEndPost(t),this.withinStartPost=t=>{const s=this.index_.compare(this.rangedFilter_.getStartPost(),t);return this.startIsInclusive_?s<=0:s<0},this.withinEndPost=t=>{const s=this.index_.compare(t,this.rangedFilter_.getEndPost());return this.endIsInclusive_?s<=0:s<0},this.rangedFilter_=new Ke(e),this.index_=e.getIndex(),this.limit_=e.getLimit(),this.reverse_=!e.isViewFromLeft(),this.startIsInclusive_=!e.startAfterSet_,this.endIsInclusive_=!e.endBeforeSet_}updateChild(e,t,s,i,r,o){return this.rangedFilter_.matches(new v(t,s))||(s=m.EMPTY_NODE),e.getImmediateChild(t).equals(s)?e:e.numChildren()<this.limit_?this.rangedFilter_.getIndexedFilter().updateChild(e,t,s,i,r,o):this.fullLimitUpdateChild_(e,t,s,r,o)}updateFullNode(e,t,s){let i;if(t.isLeafNode()||t.isEmpty())i=m.EMPTY_NODE.withIndex(this.index_);else if(this.limit_*2<t.numChildren()&&t.isIndexed(this.index_)){i=m.EMPTY_NODE.withIndex(this.index_);let r;this.reverse_?r=t.getReverseIteratorFrom(this.rangedFilter_.getEndPost(),this.index_):r=t.getIteratorFrom(this.rangedFilter_.getStartPost(),this.index_);let o=0;for(;r.hasNext()&&o<this.limit_;){const l=r.getNext();if(this.withinDirectionalStart(l))if(this.withinDirectionalEnd(l))i=i.updateImmediateChild(l.name,l.node),o++;else break;else continue}}else{i=t.withIndex(this.index_),i=i.updatePriority(m.EMPTY_NODE);let r;this.reverse_?r=i.getReverseIterator(this.index_):r=i.getIterator(this.index_);let o=0;for(;r.hasNext();){const l=r.getNext();o<this.limit_&&this.withinDirectionalStart(l)&&this.withinDirectionalEnd(l)?o++:i=i.updateImmediateChild(l.name,m.EMPTY_NODE)}}return this.rangedFilter_.getIndexedFilter().updateFullNode(e,i,s)}updatePriority(e,t){return e}filtersNodes(){return!0}getIndexedFilter(){return this.rangedFilter_.getIndexedFilter()}getIndex(){return this.index_}fullLimitUpdateChild_(e,t,s,i,r){let o;if(this.reverse_){const u=this.index_.getCompare();o=(d,_)=>u(_,d)}else o=this.index_.getCompare();const l=e;f(l.numChildren()===this.limit_,"");const a=new v(t,s),c=this.reverse_?l.getFirstChild(this.index_):l.getLastChild(this.index_),h=this.rangedFilter_.matches(a);if(l.hasChild(t)){const u=l.getImmediateChild(t);let d=i.getChildAfterChild(this.index_,c,this.reverse_);for(;d!=null&&(d.name===t||l.hasChild(d.name));)d=i.getChildAfterChild(this.index_,d,this.reverse_);const _=d==null?1:o(d,a);if(h&&!s.isEmpty()&&_>=0)return r!=null&&r.trackChildChange(Ye(t,s,u)),l.updateImmediateChild(t,s);{r!=null&&r.trackChildChange(qe(t,u));const w=l.updateImmediateChild(t,m.EMPTY_NODE);return d!=null&&this.rangedFilter_.matches(d)?(r!=null&&r.trackChildChange(Re(d.name,d.node)),w.updateImmediateChild(d.name,d.node)):w}}else return s.isEmpty()?e:h&&o(c,a)>=0?(r!=null&&(r.trackChildChange(qe(c.name,c.node)),r.trackChildChange(Re(t,s))),l.updateImmediateChild(t,s).updateImmediateChild(c.name,m.EMPTY_NODE)):e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xn{constructor(){this.limitSet_=!1,this.startSet_=!1,this.startNameSet_=!1,this.startAfterSet_=!1,this.endSet_=!1,this.endNameSet_=!1,this.endBeforeSet_=!1,this.limit_=0,this.viewFrom_="",this.indexStartValue_=null,this.indexStartName_="",this.indexEndValue_=null,this.indexEndName_="",this.index_=S}hasStart(){return this.startSet_}isViewFromLeft(){return this.viewFrom_===""?this.startSet_:this.viewFrom_==="l"}getIndexStartValue(){return f(this.startSet_,"Only valid if start has been set"),this.indexStartValue_}getIndexStartName(){return f(this.startSet_,"Only valid if start has been set"),this.startNameSet_?this.indexStartName_:re}hasEnd(){return this.endSet_}getIndexEndValue(){return f(this.endSet_,"Only valid if end has been set"),this.indexEndValue_}getIndexEndName(){return f(this.endSet_,"Only valid if end has been set"),this.endNameSet_?this.indexEndName_:ee}hasLimit(){return this.limitSet_}hasAnchoredLimit(){return this.limitSet_&&this.viewFrom_!==""}getLimit(){return f(this.limitSet_,"Only valid if limit has been set"),this.limit_}getIndex(){return this.index_}loadsAllData(){return!(this.startSet_||this.endSet_||this.limitSet_)}isDefault(){return this.loadsAllData()&&this.index_===S}copy(){const e=new xn;return e.limitSet_=this.limitSet_,e.limit_=this.limit_,e.startSet_=this.startSet_,e.startAfterSet_=this.startAfterSet_,e.indexStartValue_=this.indexStartValue_,e.startNameSet_=this.startNameSet_,e.indexStartName_=this.indexStartName_,e.endSet_=this.endSet_,e.endBeforeSet_=this.endBeforeSet_,e.indexEndValue_=this.indexEndValue_,e.endNameSet_=this.endNameSet_,e.indexEndName_=this.indexEndName_,e.index_=this.index_,e.viewFrom_=this.viewFrom_,e}}function Fo(n){return n.loadsAllData()?new Pn(n.getIndex()):n.hasLimit()?new Lo(n):new Ke(n)}function Wo(n,e){const t=n.copy();return t.limitSet_=!0,t.limit_=e,t.viewFrom_="l",t}function Uo(n,e){const t=n.copy();return t.limitSet_=!0,t.limit_=e,t.viewFrom_="r",t}function rn(n,e,t){const s=n.copy();return s.startSet_=!0,e===void 0&&(e=null),s.indexStartValue_=e,t!=null?(s.startNameSet_=!0,s.indexStartName_=t):(s.startNameSet_=!1,s.indexStartName_=""),s}function Bo(n,e,t){let s;return n.index_===$||t?s=rn(n,e,t):s=rn(n,e,ee),s.startAfterSet_=!0,s}function on(n,e,t){const s=n.copy();return s.endSet_=!0,e===void 0&&(e=null),s.indexEndValue_=e,t!==void 0?(s.endNameSet_=!0,s.indexEndName_=t):(s.endNameSet_=!1,s.indexEndName_=""),s}function Vo(n,e,t){let s;return n.index_===$||t?s=on(n,e,t):s=on(n,e,re),s.endBeforeSet_=!0,s}function bt(n,e){const t=n.copy();return t.index_=e,t}function Es(n){const e={};if(n.isDefault())return e;let t;if(n.index_===S?t="$priority":n.index_===kn?t="$value":n.index_===$?t="$key":(f(n.index_ instanceof bn,"Unrecognized index type!"),t=n.index_.toString()),e.orderBy=b(t),n.startSet_){const s=n.startAfterSet_?"startAfter":"startAt";e[s]=b(n.indexStartValue_),n.startNameSet_&&(e[s]+=","+b(n.indexStartName_))}if(n.endSet_){const s=n.endBeforeSet_?"endBefore":"endAt";e[s]=b(n.indexEndValue_),n.endNameSet_&&(e[s]+=","+b(n.indexEndName_))}return n.limitSet_&&(n.isViewFromLeft()?e.limitToFirst=n.limit_:e.limitToLast=n.limit_),e}function ws(n){const e={};if(n.startSet_&&(e.sp=n.indexStartValue_,n.startNameSet_&&(e.sn=n.indexStartName_),e.sin=!n.startAfterSet_),n.endSet_&&(e.ep=n.indexEndValue_,n.endNameSet_&&(e.en=n.indexEndName_),e.ein=!n.endBeforeSet_),n.limitSet_){e.l=n.limit_;let t=n.viewFrom_;t===""&&(n.isViewFromLeft()?t="l":t="r"),e.vf=t}return n.index_!==S&&(e.i=n.index_.toString()),e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pt extends hi{reportStats(e){throw new Error("Method not implemented.")}static getListenId_(e,t){return t!==void 0?"tag$"+t:(f(e._queryParams.isDefault(),"should have a tag if it's not a default query."),e._path.toString())}constructor(e,t,s,i){super(),this.repoInfo_=e,this.onDataUpdate_=t,this.authTokenProvider_=s,this.appCheckTokenProvider_=i,this.log_=Ze("p:rest:"),this.listens_={}}listen(e,t,s,i){const r=e._path.toString();this.log_("Listen called for "+r+" "+e._queryIdentifier);const o=pt.getListenId_(e,s),l={};this.listens_[o]=l;const a=Es(e._queryParams);this.restRequest_(r+".json",a,(c,h)=>{let u=h;if(c===404&&(u=null,c=null),c===null&&this.onDataUpdate_(r,u,!1,s),_e(this.listens_,o)===l){let d;c?c===401?d="permission_denied":d="rest_error:"+c:d="ok",i(d,null)}})}unlisten(e,t){const s=pt.getListenId_(e,t);delete this.listens_[s]}get(e){const t=Es(e._queryParams),s=e._path.toString(),i=new B;return this.restRequest_(s+".json",t,(r,o)=>{let l=o;r===404&&(l=null,r=null),r===null?(this.onDataUpdate_(s,l,!1,null),i.resolve(l)):i.reject(new Error(l))}),i.promise}refreshAuthToken(e){}restRequest_(e,t={},s){return t.format="export",Promise.all([this.authTokenProvider_.getToken(!1),this.appCheckTokenProvider_.getToken(!1)]).then(([i,r])=>{i&&i.accessToken&&(t.auth=i.accessToken),r&&r.token&&(t.ac=r.token);const o=(this.repoInfo_.secure?"https://":"http://")+this.repoInfo_.host+e+"?ns="+this.repoInfo_.namespace+_r(t);this.log_("Sending REST request for "+o);const l=new XMLHttpRequest;l.onreadystatechange=()=>{if(s&&l.readyState===4){this.log_("REST Response for "+o+" received. status:",l.status,"response:",l.responseText);let a=null;if(l.status>=200&&l.status<300){try{a=vn(l.responseText)}catch{O("Failed to parse JSON response for "+o+": "+l.responseText)}s(null,a)}else l.status!==401&&l.status!==404&&O("Got unsuccessful REST response for "+o+" Status: "+l.status),s(l.status);s=null}},l.open("GET",o,!0),l.send()})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Go{constructor(){this.rootNode_=m.EMPTY_NODE}getNode(e){return this.rootNode_.getChild(e)}updateSnapshot(e,t){this.rootNode_=this.rootNode_.updateChild(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mt(){return{value:null,children:new Map}}function De(n,e,t){if(y(e))n.value=t,n.children.clear();else if(n.value!==null)n.value=n.value.updateChild(e,t);else{const s=g(e);n.children.has(s)||n.children.set(s,mt());const i=n.children.get(s);e=T(e),De(i,e,t)}}function ln(n,e){if(y(e))return n.value=null,n.children.clear(),!0;if(n.value!==null){if(n.value.isLeafNode())return!1;{const t=n.value;return n.value=null,t.forEachChild(S,(s,i)=>{De(n,new E(s),i)}),ln(n,e)}}else if(n.children.size>0){const t=g(e);return e=T(e),n.children.has(t)&&ln(n.children.get(t),e)&&n.children.delete(t),n.children.size===0}else return!0}function an(n,e,t){n.value!==null?t(e,n.value):Ho(n,(s,i)=>{const r=new E(e.toString()+"/"+s);an(i,r,t)})}function Ho(n,e){n.children.forEach((t,s)=>{e(s,t)})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qo{constructor(e){this.collection_=e,this.last_=null}get(){const e=this.collection_.get(),t={...e};return this.last_&&A(this.last_,(s,i)=>{t[s]=t[s]-i}),this.last_=e,t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ts=10*1e3,qo=30*1e3,Yo=300*1e3;class Ko{constructor(e,t){this.server_=t,this.statsToReport_={},this.statsListener_=new Qo(e);const s=Ts+(qo-Ts)*Math.random();Be(this.reportStats_.bind(this),Math.floor(s))}reportStats_(){const e=this.statsListener_.get(),t={};let s=!1;A(e,(i,r)=>{r>0&&Y(this.statsToReport_,i)&&(t[i]=r,s=!0)}),s&&this.server_.reportStats(t),Be(this.reportStats_.bind(this),Math.floor(Math.random()*2*Yo))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Q;(function(n){n[n.OVERWRITE=0]="OVERWRITE",n[n.MERGE=1]="MERGE",n[n.ACK_USER_WRITE=2]="ACK_USER_WRITE",n[n.LISTEN_COMPLETE=3]="LISTEN_COMPLETE"})(Q||(Q={}));function An(){return{fromUser:!0,fromServer:!1,queryId:null,tagged:!1}}function Dn(){return{fromUser:!1,fromServer:!0,queryId:null,tagged:!1}}function On(n){return{fromUser:!1,fromServer:!0,queryId:n,tagged:!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gt{constructor(e,t,s){this.path=e,this.affectedTree=t,this.revert=s,this.type=Q.ACK_USER_WRITE,this.source=An()}operationForChild(e){if(y(this.path)){if(this.affectedTree.value!=null)return f(this.affectedTree.children.isEmpty(),"affectedTree should not have overlapping affected paths."),this;{const t=this.affectedTree.subtree(new E(e));return new gt(C(),t,this.revert)}}else return f(g(this.path)===e,"operationForChild called for unrelated child."),new gt(T(this.path),this.affectedTree,this.revert)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ze{constructor(e,t){this.source=e,this.path=t,this.type=Q.LISTEN_COMPLETE}operationForChild(e){return y(this.path)?new ze(this.source,C()):new ze(this.source,T(this.path))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class me{constructor(e,t,s){this.source=e,this.path=t,this.snap=s,this.type=Q.OVERWRITE}operationForChild(e){return y(this.path)?new me(this.source,C(),this.snap.getImmediateChild(e)):new me(this.source,T(this.path),this.snap)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class be{constructor(e,t,s){this.source=e,this.path=t,this.children=s,this.type=Q.MERGE}operationForChild(e){if(y(this.path)){const t=this.children.subtree(new E(e));return t.isEmpty()?null:t.value?new me(this.source,C(),t.value):new be(this.source,C(),t)}else return f(g(this.path)===e,"Can't get a merge for a child not on the path of the operation"),new be(this.source,T(this.path),this.children)}toString(){return"Operation("+this.path+": "+this.source.toString()+" merge: "+this.children.toString()+")"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class le{constructor(e,t,s){this.node_=e,this.fullyInitialized_=t,this.filtered_=s}isFullyInitialized(){return this.fullyInitialized_}isFiltered(){return this.filtered_}isCompleteForPath(e){if(y(e))return this.isFullyInitialized()&&!this.filtered_;const t=g(e);return this.isCompleteForChild(t)}isCompleteForChild(e){return this.isFullyInitialized()&&!this.filtered_||this.node_.hasChild(e)}getNode(){return this.node_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zo{constructor(e){this.query_=e,this.index_=this.query_._queryParams.getIndex()}}function jo(n,e,t,s){const i=[],r=[];return e.forEach(o=>{o.type==="child_changed"&&n.index_.indexedValueChanged(o.oldSnap,o.snapshotNode)&&r.push(Mo(o.childName,o.snapshotNode))}),Ue(n,i,"child_removed",e,s,t),Ue(n,i,"child_added",e,s,t),Ue(n,i,"child_moved",r,s,t),Ue(n,i,"child_changed",e,s,t),Ue(n,i,"value",e,s,t),i}function Ue(n,e,t,s,i,r){const o=s.filter(l=>l.type===t);o.sort((l,a)=>Xo(n,l,a)),o.forEach(l=>{const a=$o(n,l,r);i.forEach(c=>{c.respondsTo(l.type)&&e.push(c.createEvent(a,n.query_))})})}function $o(n,e,t){return e.type==="value"||e.type==="child_removed"||(e.prevName=t.getPredecessorChildName(e.childName,e.snapshotNode,n.index_)),e}function Xo(n,e,t){if(e.childName==null||t.childName==null)throw Xe("Should only compare child_ events.");const s=new v(e.childName,e.snapshotNode),i=new v(t.childName,t.snapshotNode);return n.index_.compare(s,i)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function kt(n,e){return{eventCache:n,serverCache:e}}function Ve(n,e,t,s){return kt(new le(e,t,s),n.serverCache)}function Ci(n,e,t,s){return kt(n.eventCache,new le(e,t,s))}function yt(n){return n.eventCache.isFullyInitialized()?n.eventCache.getNode():null}function ge(n){return n.serverCache.isFullyInitialized()?n.serverCache.getNode():null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let jt;const Jo=()=>(jt||(jt=new L(Dr)),jt);class I{static fromObject(e){let t=new I(null);return A(e,(s,i)=>{t=t.set(new E(s),i)}),t}constructor(e,t=Jo()){this.value=e,this.children=t}isEmpty(){return this.value===null&&this.children.isEmpty()}findRootMostMatchingPathAndValue(e,t){if(this.value!=null&&t(this.value))return{path:C(),value:this.value};if(y(e))return null;{const s=g(e),i=this.children.get(s);if(i!==null){const r=i.findRootMostMatchingPathAndValue(T(e),t);return r!=null?{path:N(new E(s),r.path),value:r.value}:null}else return null}}findRootMostValueAndPath(e){return this.findRootMostMatchingPathAndValue(e,()=>!0)}subtree(e){if(y(e))return this;{const t=g(e),s=this.children.get(t);return s!==null?s.subtree(T(e)):new I(null)}}set(e,t){if(y(e))return new I(t,this.children);{const s=g(e),r=(this.children.get(s)||new I(null)).set(T(e),t),o=this.children.insert(s,r);return new I(this.value,o)}}remove(e){if(y(e))return this.children.isEmpty()?new I(null):new I(null,this.children);{const t=g(e),s=this.children.get(t);if(s){const i=s.remove(T(e));let r;return i.isEmpty()?r=this.children.remove(t):r=this.children.insert(t,i),this.value===null&&r.isEmpty()?new I(null):new I(this.value,r)}else return this}}get(e){if(y(e))return this.value;{const t=g(e),s=this.children.get(t);return s?s.get(T(e)):null}}setTree(e,t){if(y(e))return t;{const s=g(e),r=(this.children.get(s)||new I(null)).setTree(T(e),t);let o;return r.isEmpty()?o=this.children.remove(s):o=this.children.insert(s,r),new I(this.value,o)}}fold(e){return this.fold_(C(),e)}fold_(e,t){const s={};return this.children.inorderTraversal((i,r)=>{s[i]=r.fold_(N(e,i),t)}),t(e,this.value,s)}findOnPath(e,t){return this.findOnPath_(e,C(),t)}findOnPath_(e,t,s){const i=this.value?s(t,this.value):!1;if(i)return i;if(y(e))return null;{const r=g(e),o=this.children.get(r);return o?o.findOnPath_(T(e),N(t,r),s):null}}foreachOnPath(e,t){return this.foreachOnPath_(e,C(),t)}foreachOnPath_(e,t,s){if(y(e))return this;{this.value&&s(t,this.value);const i=g(e),r=this.children.get(i);return r?r.foreachOnPath_(T(e),N(t,i),s):new I(null)}}foreach(e){this.foreach_(C(),e)}foreach_(e,t){this.children.inorderTraversal((s,i)=>{i.foreach_(N(e,s),t)}),this.value&&t(e,this.value)}foreachChild(e){this.children.inorderTraversal((t,s)=>{s.value&&e(t,s.value)})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class q{constructor(e){this.writeTree_=e}static empty(){return new q(new I(null))}}function Ge(n,e,t){if(y(e))return new q(new I(t));{const s=n.writeTree_.findRootMostValueAndPath(e);if(s!=null){const i=s.path;let r=s.value;const o=M(i,e);return r=r.updateChild(o,t),new q(n.writeTree_.set(i,r))}else{const i=new I(t),r=n.writeTree_.setTree(e,i);return new q(r)}}}function cn(n,e,t){let s=n;return A(t,(i,r)=>{s=Ge(s,N(e,i),r)}),s}function Is(n,e){if(y(e))return q.empty();{const t=n.writeTree_.setTree(e,new I(null));return new q(t)}}function hn(n,e){return Ce(n,e)!=null}function Ce(n,e){const t=n.writeTree_.findRootMostValueAndPath(e);return t!=null?n.writeTree_.get(t.path).getChild(M(t.path,e)):null}function Ss(n){const e=[],t=n.writeTree_.value;return t!=null?t.isLeafNode()||t.forEachChild(S,(s,i)=>{e.push(new v(s,i))}):n.writeTree_.children.inorderTraversal((s,i)=>{i.value!=null&&e.push(new v(s,i.value))}),e}function se(n,e){if(y(e))return n;{const t=Ce(n,e);return t!=null?new q(new I(t)):new q(n.writeTree_.subtree(e))}}function un(n){return n.writeTree_.isEmpty()}function ke(n,e){return Ei(C(),n.writeTree_,e)}function Ei(n,e,t){if(e.value!=null)return t.updateChild(n,e.value);{let s=null;return e.children.inorderTraversal((i,r)=>{i===".priority"?(f(r.value!==null,"Priority writes must always be leaf nodes"),s=r.value):t=Ei(N(n,i),r,t)}),!t.getChild(n).isEmpty()&&s!==null&&(t=t.updateChild(N(n,".priority"),s)),t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pt(n,e){return Si(e,n)}function Zo(n,e,t,s,i){f(s>n.lastWriteId,"Stacking an older write on top of newer ones"),i===void 0&&(i=!0),n.allWrites.push({path:e,snap:t,writeId:s,visible:i}),i&&(n.visibleWrites=Ge(n.visibleWrites,e,t)),n.lastWriteId=s}function el(n,e,t,s){f(s>n.lastWriteId,"Stacking an older merge on top of newer ones"),n.allWrites.push({path:e,children:t,writeId:s,visible:!0}),n.visibleWrites=cn(n.visibleWrites,e,t),n.lastWriteId=s}function tl(n,e){for(let t=0;t<n.allWrites.length;t++){const s=n.allWrites[t];if(s.writeId===e)return s}return null}function nl(n,e){const t=n.allWrites.findIndex(l=>l.writeId===e);f(t>=0,"removeWrite called with nonexistent writeId.");const s=n.allWrites[t];n.allWrites.splice(t,1);let i=s.visible,r=!1,o=n.allWrites.length-1;for(;i&&o>=0;){const l=n.allWrites[o];l.visible&&(o>=t&&sl(l,s.path)?i=!1:G(s.path,l.path)&&(r=!0)),o--}if(i){if(r)return il(n),!0;if(s.snap)n.visibleWrites=Is(n.visibleWrites,s.path);else{const l=s.children;A(l,a=>{n.visibleWrites=Is(n.visibleWrites,N(s.path,a))})}return!0}else return!1}function sl(n,e){if(n.snap)return G(n.path,e);for(const t in n.children)if(n.children.hasOwnProperty(t)&&G(N(n.path,t),e))return!0;return!1}function il(n){n.visibleWrites=wi(n.allWrites,rl,C()),n.allWrites.length>0?n.lastWriteId=n.allWrites[n.allWrites.length-1].writeId:n.lastWriteId=-1}function rl(n){return n.visible}function wi(n,e,t){let s=q.empty();for(let i=0;i<n.length;++i){const r=n[i];if(e(r)){const o=r.path;let l;if(r.snap)G(t,o)?(l=M(t,o),s=Ge(s,l,r.snap)):G(o,t)&&(l=M(o,t),s=Ge(s,C(),r.snap.getChild(l)));else if(r.children){if(G(t,o))l=M(t,o),s=cn(s,l,r.children);else if(G(o,t))if(l=M(o,t),y(l))s=cn(s,C(),r.children);else{const a=_e(r.children,g(l));if(a){const c=a.getChild(T(l));s=Ge(s,C(),c)}}}else throw Xe("WriteRecord should have .snap or .children")}}return s}function Ti(n,e,t,s,i){if(!s&&!i){const r=Ce(n.visibleWrites,e);if(r!=null)return r;{const o=se(n.visibleWrites,e);if(un(o))return t;if(t==null&&!hn(o,C()))return null;{const l=t||m.EMPTY_NODE;return ke(o,l)}}}else{const r=se(n.visibleWrites,e);if(!i&&un(r))return t;if(!i&&t==null&&!hn(r,C()))return null;{const o=function(c){return(c.visible||i)&&(!s||!~s.indexOf(c.writeId))&&(G(c.path,e)||G(e,c.path))},l=wi(n.allWrites,o,e),a=t||m.EMPTY_NODE;return ke(l,a)}}}function ol(n,e,t){let s=m.EMPTY_NODE;const i=Ce(n.visibleWrites,e);if(i)return i.isLeafNode()||i.forEachChild(S,(r,o)=>{s=s.updateImmediateChild(r,o)}),s;if(t){const r=se(n.visibleWrites,e);return t.forEachChild(S,(o,l)=>{const a=ke(se(r,new E(o)),l);s=s.updateImmediateChild(o,a)}),Ss(r).forEach(o=>{s=s.updateImmediateChild(o.name,o.node)}),s}else{const r=se(n.visibleWrites,e);return Ss(r).forEach(o=>{s=s.updateImmediateChild(o.name,o.node)}),s}}function ll(n,e,t,s,i){f(s||i,"Either existingEventSnap or existingServerSnap must exist");const r=N(e,t);if(hn(n.visibleWrites,r))return null;{const o=se(n.visibleWrites,r);return un(o)?i.getChild(t):ke(o,i.getChild(t))}}function al(n,e,t,s){const i=N(e,t),r=Ce(n.visibleWrites,i);if(r!=null)return r;if(s.isCompleteForChild(t)){const o=se(n.visibleWrites,i);return ke(o,s.getNode().getImmediateChild(t))}else return null}function cl(n,e){return Ce(n.visibleWrites,e)}function hl(n,e,t,s,i,r,o){let l;const a=se(n.visibleWrites,e),c=Ce(a,C());if(c!=null)l=c;else if(t!=null)l=ke(a,t);else return[];if(l=l.withIndex(o),!l.isEmpty()&&!l.isLeafNode()){const h=[],u=o.getCompare(),d=r?l.getReverseIteratorFrom(s,o):l.getIteratorFrom(s,o);let _=d.getNext();for(;_&&h.length<i;)u(_,s)!==0&&h.push(_),_=d.getNext();return h}else return[]}function ul(){return{visibleWrites:q.empty(),allWrites:[],lastWriteId:-1}}function vt(n,e,t,s){return Ti(n.writeTree,n.treePath,e,t,s)}function Mn(n,e){return ol(n.writeTree,n.treePath,e)}function Ns(n,e,t,s){return ll(n.writeTree,n.treePath,e,t,s)}function Ct(n,e){return cl(n.writeTree,N(n.treePath,e))}function dl(n,e,t,s,i,r){return hl(n.writeTree,n.treePath,e,t,s,i,r)}function Ln(n,e,t){return al(n.writeTree,n.treePath,e,t)}function Ii(n,e){return Si(N(n.treePath,e),n.writeTree)}function Si(n,e){return{treePath:n,writeTree:e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fl{constructor(){this.changeMap=new Map}trackChildChange(e){const t=e.type,s=e.childName;f(t==="child_added"||t==="child_changed"||t==="child_removed","Only child changes supported for tracking"),f(s!==".priority","Only non-priority child changes can be tracked.");const i=this.changeMap.get(s);if(i){const r=i.type;if(t==="child_added"&&r==="child_removed")this.changeMap.set(s,Ye(s,e.snapshotNode,i.snapshotNode));else if(t==="child_removed"&&r==="child_added")this.changeMap.delete(s);else if(t==="child_removed"&&r==="child_changed")this.changeMap.set(s,qe(s,i.oldSnap));else if(t==="child_changed"&&r==="child_added")this.changeMap.set(s,Re(s,e.snapshotNode));else if(t==="child_changed"&&r==="child_changed")this.changeMap.set(s,Ye(s,e.snapshotNode,i.oldSnap));else throw Xe("Illegal combination of changes: "+e+" occurred after "+i)}else this.changeMap.set(s,e)}getChanges(){return Array.from(this.changeMap.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _l{getCompleteChild(e){return null}getChildAfterChild(e,t,s){return null}}const Ni=new _l;class Fn{constructor(e,t,s=null){this.writes_=e,this.viewCache_=t,this.optCompleteServerCache_=s}getCompleteChild(e){const t=this.viewCache_.eventCache;if(t.isCompleteForChild(e))return t.getNode().getImmediateChild(e);{const s=this.optCompleteServerCache_!=null?new le(this.optCompleteServerCache_,!0,!1):this.viewCache_.serverCache;return Ln(this.writes_,e,s)}}getChildAfterChild(e,t,s){const i=this.optCompleteServerCache_!=null?this.optCompleteServerCache_:ge(this.viewCache_),r=dl(this.writes_,i,t,1,s,e);return r.length===0?null:r[0]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pl(n){return{filter:n}}function ml(n,e){f(e.eventCache.getNode().isIndexed(n.filter.getIndex()),"Event snap not indexed"),f(e.serverCache.getNode().isIndexed(n.filter.getIndex()),"Server snap not indexed")}function gl(n,e,t,s,i){const r=new fl;let o,l;if(t.type===Q.OVERWRITE){const c=t;c.source.fromUser?o=dn(n,e,c.path,c.snap,s,i,r):(f(c.source.fromServer,"Unknown source."),l=c.source.tagged||e.serverCache.isFiltered()&&!y(c.path),o=Et(n,e,c.path,c.snap,s,i,l,r))}else if(t.type===Q.MERGE){const c=t;c.source.fromUser?o=vl(n,e,c.path,c.children,s,i,r):(f(c.source.fromServer,"Unknown source."),l=c.source.tagged||e.serverCache.isFiltered(),o=fn(n,e,c.path,c.children,s,i,l,r))}else if(t.type===Q.ACK_USER_WRITE){const c=t;c.revert?o=wl(n,e,c.path,s,i,r):o=Cl(n,e,c.path,c.affectedTree,s,i,r)}else if(t.type===Q.LISTEN_COMPLETE)o=El(n,e,t.path,s,r);else throw Xe("Unknown operation type: "+t.type);const a=r.getChanges();return yl(e,o,a),{viewCache:o,changes:a}}function yl(n,e,t){const s=e.eventCache;if(s.isFullyInitialized()){const i=s.getNode().isLeafNode()||s.getNode().isEmpty(),r=yt(n);(t.length>0||!n.eventCache.isFullyInitialized()||i&&!s.getNode().equals(r)||!s.getNode().getPriority().equals(r.getPriority()))&&t.push(vi(yt(e)))}}function Ri(n,e,t,s,i,r){const o=e.eventCache;if(Ct(s,t)!=null)return e;{let l,a;if(y(t))if(f(e.serverCache.isFullyInitialized(),"If change path is empty, we must have complete server data"),e.serverCache.isFiltered()){const c=ge(e),h=c instanceof m?c:m.EMPTY_NODE,u=Mn(s,h);l=n.filter.updateFullNode(e.eventCache.getNode(),u,r)}else{const c=vt(s,ge(e));l=n.filter.updateFullNode(e.eventCache.getNode(),c,r)}else{const c=g(t);if(c===".priority"){f(oe(t)===1,"Can't have a priority with additional path components");const h=o.getNode();a=e.serverCache.getNode();const u=Ns(s,t,h,a);u!=null?l=n.filter.updatePriority(h,u):l=o.getNode()}else{const h=T(t);let u;if(o.isCompleteForChild(c)){a=e.serverCache.getNode();const d=Ns(s,t,o.getNode(),a);d!=null?u=o.getNode().getImmediateChild(c).updateChild(h,d):u=o.getNode().getImmediateChild(c)}else u=Ln(s,c,e.serverCache);u!=null?l=n.filter.updateChild(o.getNode(),c,u,h,i,r):l=o.getNode()}}return Ve(e,l,o.isFullyInitialized()||y(t),n.filter.filtersNodes())}}function Et(n,e,t,s,i,r,o,l){const a=e.serverCache;let c;const h=o?n.filter:n.filter.getIndexedFilter();if(y(t))c=h.updateFullNode(a.getNode(),s,null);else if(h.filtersNodes()&&!a.isFiltered()){const _=a.getNode().updateChild(t,s);c=h.updateFullNode(a.getNode(),_,null)}else{const _=g(t);if(!a.isCompleteForPath(t)&&oe(t)>1)return e;const p=T(t),D=a.getNode().getImmediateChild(_).updateChild(p,s);_===".priority"?c=h.updatePriority(a.getNode(),D):c=h.updateChild(a.getNode(),_,D,p,Ni,null)}const u=Ci(e,c,a.isFullyInitialized()||y(t),h.filtersNodes()),d=new Fn(i,u,r);return Ri(n,u,t,i,d,l)}function dn(n,e,t,s,i,r,o){const l=e.eventCache;let a,c;const h=new Fn(i,e,r);if(y(t))c=n.filter.updateFullNode(e.eventCache.getNode(),s,o),a=Ve(e,c,!0,n.filter.filtersNodes());else{const u=g(t);if(u===".priority")c=n.filter.updatePriority(e.eventCache.getNode(),s),a=Ve(e,c,l.isFullyInitialized(),l.isFiltered());else{const d=T(t),_=l.getNode().getImmediateChild(u);let p;if(y(d))p=s;else{const w=h.getCompleteChild(u);w!=null?In(d)===".priority"&&w.getChild(di(d)).isEmpty()?p=w:p=w.updateChild(d,s):p=m.EMPTY_NODE}if(_.equals(p))a=e;else{const w=n.filter.updateChild(l.getNode(),u,p,d,h,o);a=Ve(e,w,l.isFullyInitialized(),n.filter.filtersNodes())}}}return a}function Rs(n,e){return n.eventCache.isCompleteForChild(e)}function vl(n,e,t,s,i,r,o){let l=e;return s.foreach((a,c)=>{const h=N(t,a);Rs(e,g(h))&&(l=dn(n,l,h,c,i,r,o))}),s.foreach((a,c)=>{const h=N(t,a);Rs(e,g(h))||(l=dn(n,l,h,c,i,r,o))}),l}function bs(n,e,t){return t.foreach((s,i)=>{e=e.updateChild(s,i)}),e}function fn(n,e,t,s,i,r,o,l){if(e.serverCache.getNode().isEmpty()&&!e.serverCache.isFullyInitialized())return e;let a=e,c;y(t)?c=s:c=new I(null).setTree(t,s);const h=e.serverCache.getNode();return c.children.inorderTraversal((u,d)=>{if(h.hasChild(u)){const _=e.serverCache.getNode().getImmediateChild(u),p=bs(n,_,d);a=Et(n,a,new E(u),p,i,r,o,l)}}),c.children.inorderTraversal((u,d)=>{const _=!e.serverCache.isCompleteForChild(u)&&d.value===null;if(!h.hasChild(u)&&!_){const p=e.serverCache.getNode().getImmediateChild(u),w=bs(n,p,d);a=Et(n,a,new E(u),w,i,r,o,l)}}),a}function Cl(n,e,t,s,i,r,o){if(Ct(i,t)!=null)return e;const l=e.serverCache.isFiltered(),a=e.serverCache;if(s.value!=null){if(y(t)&&a.isFullyInitialized()||a.isCompleteForPath(t))return Et(n,e,t,a.getNode().getChild(t),i,r,l,o);if(y(t)){let c=new I(null);return a.getNode().forEachChild($,(h,u)=>{c=c.set(new E(h),u)}),fn(n,e,t,c,i,r,l,o)}else return e}else{let c=new I(null);return s.foreach((h,u)=>{const d=N(t,h);a.isCompleteForPath(d)&&(c=c.set(h,a.getNode().getChild(d)))}),fn(n,e,t,c,i,r,l,o)}}function El(n,e,t,s,i){const r=e.serverCache,o=Ci(e,r.getNode(),r.isFullyInitialized()||y(t),r.isFiltered());return Ri(n,o,t,s,Ni,i)}function wl(n,e,t,s,i,r){let o;if(Ct(s,t)!=null)return e;{const l=new Fn(s,e,i),a=e.eventCache.getNode();let c;if(y(t)||g(t)===".priority"){let h;if(e.serverCache.isFullyInitialized())h=vt(s,ge(e));else{const u=e.serverCache.getNode();f(u instanceof m,"serverChildren would be complete if leaf node"),h=Mn(s,u)}h=h,c=n.filter.updateFullNode(a,h,r)}else{const h=g(t);let u=Ln(s,h,e.serverCache);u==null&&e.serverCache.isCompleteForChild(h)&&(u=a.getImmediateChild(h)),u!=null?c=n.filter.updateChild(a,h,u,T(t),l,r):e.eventCache.getNode().hasChild(h)?c=n.filter.updateChild(a,h,m.EMPTY_NODE,T(t),l,r):c=a,c.isEmpty()&&e.serverCache.isFullyInitialized()&&(o=vt(s,ge(e)),o.isLeafNode()&&(c=n.filter.updateFullNode(c,o,r)))}return o=e.serverCache.isFullyInitialized()||Ct(s,C())!=null,Ve(e,c,o,n.filter.filtersNodes())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Tl{constructor(e,t){this.query_=e,this.eventRegistrations_=[];const s=this.query_._queryParams,i=new Pn(s.getIndex()),r=Fo(s);this.processor_=pl(r);const o=t.serverCache,l=t.eventCache,a=i.updateFullNode(m.EMPTY_NODE,o.getNode(),null),c=r.updateFullNode(m.EMPTY_NODE,l.getNode(),null),h=new le(a,o.isFullyInitialized(),i.filtersNodes()),u=new le(c,l.isFullyInitialized(),r.filtersNodes());this.viewCache_=kt(u,h),this.eventGenerator_=new zo(this.query_)}get query(){return this.query_}}function Il(n){return n.viewCache_.serverCache.getNode()}function Sl(n){return yt(n.viewCache_)}function Nl(n,e){const t=ge(n.viewCache_);return t&&(n.query._queryParams.loadsAllData()||!y(e)&&!t.getImmediateChild(g(e)).isEmpty())?t.getChild(e):null}function ks(n){return n.eventRegistrations_.length===0}function Rl(n,e){n.eventRegistrations_.push(e)}function Ps(n,e,t){const s=[];if(t){f(e==null,"A cancel should cancel all event registrations.");const i=n.query._path;n.eventRegistrations_.forEach(r=>{const o=r.createCancelEvent(t,i);o&&s.push(o)})}if(e){let i=[];for(let r=0;r<n.eventRegistrations_.length;++r){const o=n.eventRegistrations_[r];if(!o.matches(e))i.push(o);else if(e.hasAnyCallback()){i=i.concat(n.eventRegistrations_.slice(r+1));break}}n.eventRegistrations_=i}else n.eventRegistrations_=[];return s}function xs(n,e,t,s){e.type===Q.MERGE&&e.source.queryId!==null&&(f(ge(n.viewCache_),"We should always have a full cache before handling merges"),f(yt(n.viewCache_),"Missing event cache, even though we have a server cache"));const i=n.viewCache_,r=gl(n.processor_,i,e,t,s);return ml(n.processor_,r.viewCache),f(r.viewCache.serverCache.isFullyInitialized()||!i.serverCache.isFullyInitialized(),"Once a server snap is complete, it should never go back"),n.viewCache_=r.viewCache,bi(n,r.changes,r.viewCache.eventCache.getNode(),null)}function bl(n,e){const t=n.viewCache_.eventCache,s=[];return t.getNode().isLeafNode()||t.getNode().forEachChild(S,(r,o)=>{s.push(Re(r,o))}),t.isFullyInitialized()&&s.push(vi(t.getNode())),bi(n,s,t.getNode(),e)}function bi(n,e,t,s){const i=s?[s]:n.eventRegistrations_;return jo(n.eventGenerator_,e,t,i)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let wt;class ki{constructor(){this.views=new Map}}function kl(n){f(!wt,"__referenceConstructor has already been defined"),wt=n}function Pl(){return f(wt,"Reference.ts has not been loaded"),wt}function xl(n){return n.views.size===0}function Wn(n,e,t,s){const i=e.source.queryId;if(i!==null){const r=n.views.get(i);return f(r!=null,"SyncTree gave us an op for an invalid query."),xs(r,e,t,s)}else{let r=[];for(const o of n.views.values())r=r.concat(xs(o,e,t,s));return r}}function Pi(n,e,t,s,i){const r=e._queryIdentifier,o=n.views.get(r);if(!o){let l=vt(t,i?s:null),a=!1;l?a=!0:s instanceof m?(l=Mn(t,s),a=!1):(l=m.EMPTY_NODE,a=!1);const c=kt(new le(l,a,!1),new le(s,i,!1));return new Tl(e,c)}return o}function Al(n,e,t,s,i,r){const o=Pi(n,e,s,i,r);return n.views.has(e._queryIdentifier)||n.views.set(e._queryIdentifier,o),Rl(o,t),bl(o,t)}function Dl(n,e,t,s){const i=e._queryIdentifier,r=[];let o=[];const l=ae(n);if(i==="default")for(const[a,c]of n.views.entries())o=o.concat(Ps(c,t,s)),ks(c)&&(n.views.delete(a),c.query._queryParams.loadsAllData()||r.push(c.query));else{const a=n.views.get(i);a&&(o=o.concat(Ps(a,t,s)),ks(a)&&(n.views.delete(i),a.query._queryParams.loadsAllData()||r.push(a.query)))}return l&&!ae(n)&&r.push(new(Pl())(e._repo,e._path)),{removed:r,events:o}}function xi(n){const e=[];for(const t of n.views.values())t.query._queryParams.loadsAllData()||e.push(t);return e}function ie(n,e){let t=null;for(const s of n.views.values())t=t||Nl(s,e);return t}function Ai(n,e){if(e._queryParams.loadsAllData())return xt(n);{const s=e._queryIdentifier;return n.views.get(s)}}function Di(n,e){return Ai(n,e)!=null}function ae(n){return xt(n)!=null}function xt(n){for(const e of n.views.values())if(e.query._queryParams.loadsAllData())return e;return null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Tt;function Ol(n){f(!Tt,"__referenceConstructor has already been defined"),Tt=n}function Ml(){return f(Tt,"Reference.ts has not been loaded"),Tt}let Ll=1;class As{constructor(e){this.listenProvider_=e,this.syncPointTree_=new I(null),this.pendingWriteTree_=ul(),this.tagToQueryMap=new Map,this.queryToTagMap=new Map}}function Un(n,e,t,s,i){return Zo(n.pendingWriteTree_,e,t,s,i),i?Oe(n,new me(An(),e,t)):[]}function Fl(n,e,t,s){el(n.pendingWriteTree_,e,t,s);const i=I.fromObject(t);return Oe(n,new be(An(),e,i))}function ne(n,e,t=!1){const s=tl(n.pendingWriteTree_,e);if(nl(n.pendingWriteTree_,e)){let r=new I(null);return s.snap!=null?r=r.set(C(),!0):A(s.children,o=>{r=r.set(new E(o),!0)}),Oe(n,new gt(s.path,r,t))}else return[]}function tt(n,e,t){return Oe(n,new me(Dn(),e,t))}function Wl(n,e,t){const s=I.fromObject(t);return Oe(n,new be(Dn(),e,s))}function Ul(n,e){return Oe(n,new ze(Dn(),e))}function Bl(n,e,t){const s=Bn(n,t);if(s){const i=Vn(s),r=i.path,o=i.queryId,l=M(r,e),a=new ze(On(o),l);return Gn(n,r,a)}else return[]}function It(n,e,t,s,i=!1){const r=e._path,o=n.syncPointTree_.get(r);let l=[];if(o&&(e._queryIdentifier==="default"||Di(o,e))){const a=Dl(o,e,t,s);xl(o)&&(n.syncPointTree_=n.syncPointTree_.remove(r));const c=a.removed;if(l=a.events,!i){const h=c.findIndex(d=>d._queryParams.loadsAllData())!==-1,u=n.syncPointTree_.findOnPath(r,(d,_)=>ae(_));if(h&&!u){const d=n.syncPointTree_.subtree(r);if(!d.isEmpty()){const _=Hl(d);for(let p=0;p<_.length;++p){const w=_[p],D=w.query,we=Fi(n,w);n.listenProvider_.startListening(He(D),je(n,D),we.hashFn,we.onComplete)}}}!u&&c.length>0&&!s&&(h?n.listenProvider_.stopListening(He(e),null):c.forEach(d=>{const _=n.queryToTagMap.get(Dt(d));n.listenProvider_.stopListening(He(d),_)}))}Ql(n,c)}return l}function Oi(n,e,t,s){const i=Bn(n,s);if(i!=null){const r=Vn(i),o=r.path,l=r.queryId,a=M(o,e),c=new me(On(l),a,t);return Gn(n,o,c)}else return[]}function Vl(n,e,t,s){const i=Bn(n,s);if(i){const r=Vn(i),o=r.path,l=r.queryId,a=M(o,e),c=I.fromObject(t),h=new be(On(l),a,c);return Gn(n,o,h)}else return[]}function _n(n,e,t,s=!1){const i=e._path;let r=null,o=!1;n.syncPointTree_.foreachOnPath(i,(d,_)=>{const p=M(d,i);r=r||ie(_,p),o=o||ae(_)});let l=n.syncPointTree_.get(i);l?(o=o||ae(l),r=r||ie(l,C())):(l=new ki,n.syncPointTree_=n.syncPointTree_.set(i,l));let a;r!=null?a=!0:(a=!1,r=m.EMPTY_NODE,n.syncPointTree_.subtree(i).foreachChild((_,p)=>{const w=ie(p,C());w&&(r=r.updateImmediateChild(_,w))}));const c=Di(l,e);if(!c&&!e._queryParams.loadsAllData()){const d=Dt(e);f(!n.queryToTagMap.has(d),"View does not exist, but we have a tag");const _=ql();n.queryToTagMap.set(d,_),n.tagToQueryMap.set(_,d)}const h=Pt(n.pendingWriteTree_,i);let u=Al(l,e,t,h,r,a);if(!c&&!o&&!s){const d=Ai(l,e);u=u.concat(Yl(n,e,d))}return u}function At(n,e,t){const i=n.pendingWriteTree_,r=n.syncPointTree_.findOnPath(e,(o,l)=>{const a=M(o,e),c=ie(l,a);if(c)return c});return Ti(i,e,r,t,!0)}function Gl(n,e){const t=e._path;let s=null;n.syncPointTree_.foreachOnPath(t,(c,h)=>{const u=M(c,t);s=s||ie(h,u)});let i=n.syncPointTree_.get(t);i?s=s||ie(i,C()):(i=new ki,n.syncPointTree_=n.syncPointTree_.set(t,i));const r=s!=null,o=r?new le(s,!0,!1):null,l=Pt(n.pendingWriteTree_,e._path),a=Pi(i,e,l,r?o.getNode():m.EMPTY_NODE,r);return Sl(a)}function Oe(n,e){return Mi(e,n.syncPointTree_,null,Pt(n.pendingWriteTree_,C()))}function Mi(n,e,t,s){if(y(n.path))return Li(n,e,t,s);{const i=e.get(C());t==null&&i!=null&&(t=ie(i,C()));let r=[];const o=g(n.path),l=n.operationForChild(o),a=e.children.get(o);if(a&&l){const c=t?t.getImmediateChild(o):null,h=Ii(s,o);r=r.concat(Mi(l,a,c,h))}return i&&(r=r.concat(Wn(i,n,s,t))),r}}function Li(n,e,t,s){const i=e.get(C());t==null&&i!=null&&(t=ie(i,C()));let r=[];return e.children.inorderTraversal((o,l)=>{const a=t?t.getImmediateChild(o):null,c=Ii(s,o),h=n.operationForChild(o);h&&(r=r.concat(Li(h,l,a,c)))}),i&&(r=r.concat(Wn(i,n,s,t))),r}function Fi(n,e){const t=e.query,s=je(n,t);return{hashFn:()=>(Il(e)||m.EMPTY_NODE).hash(),onComplete:i=>{if(i==="ok")return s?Bl(n,t._path,s):Ul(n,t._path);{const r=Lr(i,t);return It(n,t,null,r)}}}}function je(n,e){const t=Dt(e);return n.queryToTagMap.get(t)}function Dt(n){return n._path.toString()+"$"+n._queryIdentifier}function Bn(n,e){return n.tagToQueryMap.get(e)}function Vn(n){const e=n.indexOf("$");return f(e!==-1&&e<n.length-1,"Bad queryKey."),{queryId:n.substr(e+1),path:new E(n.substr(0,e))}}function Gn(n,e,t){const s=n.syncPointTree_.get(e);f(s,"Missing sync point for query tag that we're tracking");const i=Pt(n.pendingWriteTree_,e);return Wn(s,t,i,null)}function Hl(n){return n.fold((e,t,s)=>{if(t&&ae(t))return[xt(t)];{let i=[];return t&&(i=xi(t)),A(s,(r,o)=>{i=i.concat(o)}),i}})}function He(n){return n._queryParams.loadsAllData()&&!n._queryParams.isDefault()?new(Ml())(n._repo,n._path):n}function Ql(n,e){for(let t=0;t<e.length;++t){const s=e[t];if(!s._queryParams.loadsAllData()){const i=Dt(s),r=n.queryToTagMap.get(i);n.queryToTagMap.delete(i),n.tagToQueryMap.delete(r)}}}function ql(){return Ll++}function Yl(n,e,t){const s=e._path,i=je(n,e),r=Fi(n,t),o=n.listenProvider_.startListening(He(e),i,r.hashFn,r.onComplete),l=n.syncPointTree_.subtree(s);if(i)f(!ae(l.value),"If we're adding a query, it shouldn't be shadowed");else{const a=l.fold((c,h,u)=>{if(!y(c)&&h&&ae(h))return[xt(h).query];{let d=[];return h&&(d=d.concat(xi(h).map(_=>_.query))),A(u,(_,p)=>{d=d.concat(p)}),d}});for(let c=0;c<a.length;++c){const h=a[c];n.listenProvider_.stopListening(He(h),je(n,h))}}return o}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hn{constructor(e){this.node_=e}getImmediateChild(e){const t=this.node_.getImmediateChild(e);return new Hn(t)}node(){return this.node_}}class Qn{constructor(e,t){this.syncTree_=e,this.path_=t}getImmediateChild(e){const t=N(this.path_,e);return new Qn(this.syncTree_,t)}node(){return At(this.syncTree_,this.path_)}}const Kl=function(n){return n=n||{},n.timestamp=n.timestamp||new Date().getTime(),n},Ds=function(n,e,t){if(!n||typeof n!="object")return n;if(f(".sv"in n,"Unexpected leaf node or priority contents"),typeof n[".sv"]=="string")return zl(n[".sv"],e,t);if(typeof n[".sv"]=="object")return jl(n[".sv"],e);f(!1,"Unexpected server value: "+JSON.stringify(n,null,2))},zl=function(n,e,t){switch(n){case"timestamp":return t.timestamp;default:f(!1,"Unexpected server value: "+n)}},jl=function(n,e,t){n.hasOwnProperty("increment")||f(!1,"Unexpected server value: "+JSON.stringify(n,null,2));const s=n.increment;typeof s!="number"&&f(!1,"Unexpected increment value: "+s);const i=e.node();if(f(i!==null&&typeof i<"u","Expected ChildrenNode.EMPTY_NODE for nulls"),!i.isLeafNode())return s;const o=i.getValue();return typeof o!="number"?s:o+s},Wi=function(n,e,t,s){return Yn(e,new Qn(t,n),s)},qn=function(n,e,t){return Yn(n,new Hn(e),t)};function Yn(n,e,t){const s=n.getPriority().val(),i=Ds(s,e.getImmediateChild(".priority"),t);let r;if(n.isLeafNode()){const o=n,l=Ds(o.getValue(),e,t);return l!==o.getValue()||i!==o.getPriority().val()?new k(l,R(i)):n}else{const o=n;return r=o,i!==o.getPriority().val()&&(r=r.updatePriority(new k(i))),o.forEachChild(S,(l,a)=>{const c=Yn(a,e.getImmediateChild(l),t);c!==a&&(r=r.updateImmediateChild(l,c))}),r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Kn{constructor(e="",t=null,s={children:{},childCount:0}){this.name=e,this.parent=t,this.node=s}}function Ot(n,e){let t=e instanceof E?e:new E(e),s=n,i=g(t);for(;i!==null;){const r=_e(s.node.children,i)||{children:{},childCount:0};s=new Kn(i,s,r),t=T(t),i=g(t)}return s}function Ee(n){return n.node.value}function zn(n,e){n.node.value=e,pn(n)}function Ui(n){return n.node.childCount>0}function $l(n){return Ee(n)===void 0&&!Ui(n)}function Mt(n,e){A(n.node.children,(t,s)=>{e(new Kn(t,n,s))})}function Bi(n,e,t,s){t&&e(n),Mt(n,i=>{Bi(i,e,!0)})}function Xl(n,e,t){let s=n.parent;for(;s!==null;){if(e(s))return!0;s=s.parent}return!1}function nt(n){return new E(n.parent===null?n.name:nt(n.parent)+"/"+n.name)}function pn(n){n.parent!==null&&Jl(n.parent,n.name,n)}function Jl(n,e,t){const s=$l(t),i=Y(n.node.children,e);s&&i?(delete n.node.children[e],n.node.childCount--,pn(n)):!s&&!i&&(n.node.children[e]=t.node,n.node.childCount++,pn(n))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zl=/[\[\].#$\/\u0000-\u001F\u007F]/,ea=/[\[\].#$\u0000-\u001F\u007F]/,$t=10*1024*1024,Lt=function(n){return typeof n=="string"&&n.length!==0&&!Zl.test(n)},Vi=function(n){return typeof n=="string"&&n.length!==0&&!ea.test(n)},ta=function(n){return n&&(n=n.replace(/^\/*\.info(\/|$)/,"/")),Vi(n)},$e=function(n){return n===null||typeof n=="string"||typeof n=="number"&&!Nt(n)||n&&typeof n=="object"&&Y(n,".sv")},J=function(n,e,t,s){s&&e===void 0||st(pe(n,"value"),e,t)},st=function(n,e,t){const s=t instanceof E?new go(t,n):t;if(e===void 0)throw new Error(n+"contains undefined "+ue(s));if(typeof e=="function")throw new Error(n+"contains a function "+ue(s)+" with contents = "+e.toString());if(Nt(e))throw new Error(n+"contains "+e.toString()+" "+ue(s));if(typeof e=="string"&&e.length>$t/3&&St(e)>$t)throw new Error(n+"contains a string greater than "+$t+" utf8 bytes "+ue(s)+" ('"+e.substring(0,50)+"...')");if(e&&typeof e=="object"){let i=!1,r=!1;if(A(e,(o,l)=>{if(o===".value")i=!0;else if(o!==".priority"&&o!==".sv"&&(r=!0,!Lt(o)))throw new Error(n+" contains an invalid key ("+o+") "+ue(s)+`.  Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"`);yo(s,o),st(n,l,s),vo(s)}),i&&r)throw new Error(n+' contains ".value" child '+ue(s)+" in addition to actual children.")}},na=function(n,e){let t,s;for(t=0;t<e.length;t++){s=e[t];const r=Qe(s);for(let o=0;o<r.length;o++)if(!(r[o]===".priority"&&o===r.length-1)){if(!Lt(r[o]))throw new Error(n+"contains an invalid key ("+r[o]+") in path "+s.toString()+`. Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"`)}}e.sort(mo);let i=null;for(t=0;t<e.length;t++){if(s=e[t],i!==null&&G(i,s))throw new Error(n+"contains a path "+i.toString()+" that is ancestor of another path "+s.toString());i=s}},Gi=function(n,e,t,s){const i=pe(n,"values");if(!(e&&typeof e=="object")||Array.isArray(e))throw new Error(i+" must be an object containing the children to replace.");const r=[];A(e,(o,l)=>{const a=new E(o);if(st(i,l,N(t,a)),In(a)===".priority"&&!$e(l))throw new Error(i+"contains an invalid value for '"+a.toString()+"', which must be a valid Firebase priority (a string, finite number, server value, or null).");r.push(a)}),na(i,r)},jn=function(n,e,t){if(Nt(e))throw new Error(pe(n,"priority")+"is "+e.toString()+", but must be a valid Firebase priority (a string, finite number, server value, or null).");if(!$e(e))throw new Error(pe(n,"priority")+"must be a valid Firebase priority (a string, finite number, server value, or null).")},it=function(n,e,t,s){if(t!==void 0&&!Lt(t))throw new Error(pe(n,e)+'was an invalid key = "'+t+`".  Firebase keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]").`)},$n=function(n,e,t,s){if(!(s&&t===void 0)&&!Vi(t))throw new Error(pe(n,e)+'was an invalid path = "'+t+`". Paths must be non-empty strings and can't contain ".", "#", "$", "[", or "]"`)},sa=function(n,e,t,s){t&&(t=t.replace(/^\/*\.info(\/|$)/,"/")),$n(n,e,t,s)},j=function(n,e){if(g(e)===".info")throw new Error(n+" failed = Can't modify data under /.info/")},Hi=function(n,e){const t=e.path.toString();if(typeof e.repoInfo.host!="string"||e.repoInfo.host.length===0||!Lt(e.repoInfo.namespace)&&e.repoInfo.host.split(":")[0]!=="localhost"||t.length!==0&&!ta(t))throw new Error(pe(n,"url")+`must be a valid firebase URL and the path can't contain ".", "#", "$", "[", or "]".`)};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ia{constructor(){this.eventLists_=[],this.recursionDepth_=0}}function Ft(n,e){let t=null;for(let s=0;s<e.length;s++){const i=e[s],r=i.getPath();t!==null&&!Sn(r,t.path)&&(n.eventLists_.push(t),t=null),t===null&&(t={events:[],path:r}),t.events.push(i)}t&&n.eventLists_.push(t)}function Qi(n,e,t){Ft(n,t),qi(n,s=>Sn(s,e))}function W(n,e,t){Ft(n,t),qi(n,s=>G(s,e)||G(e,s))}function qi(n,e){n.recursionDepth_++;let t=!0;for(let s=0;s<n.eventLists_.length;s++){const i=n.eventLists_[s];if(i){const r=i.path;e(r)?(ra(n.eventLists_[s]),n.eventLists_[s]=null):t=!1}}t&&(n.eventLists_=[]),n.recursionDepth_--}function ra(n){for(let e=0;e<n.events.length;e++){const t=n.events[e];if(t!==null){n.events[e]=null;const s=t.getEventRunner();fe&&x("event: "+t.toString()),Ae(s)}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Yi="repo_interrupt",oa=25;class la{constructor(e,t,s,i){this.repoInfo_=e,this.forceRestClient_=t,this.authTokenProvider_=s,this.appCheckProvider_=i,this.dataUpdateCount=0,this.statsListener_=null,this.eventQueue_=new ia,this.nextWriteId_=1,this.interceptServerDataCallback_=null,this.onDisconnect_=mt(),this.transactionQueueTree_=new Kn,this.persistentConnection_=null,this.key=this.repoInfo_.toURLString()}toString(){return(this.repoInfo_.secure?"https://":"http://")+this.repoInfo_.host}}function aa(n,e,t){if(n.stats_=wn(n.repoInfo_),n.forceRestClient_||Br())n.server_=new pt(n.repoInfo_,(s,i,r,o)=>{Os(n,s,i,r,o)},n.authTokenProvider_,n.appCheckProvider_),setTimeout(()=>Ms(n,!0),0);else{if(typeof t<"u"&&t!==null){if(typeof t!="object")throw new Error("Only objects are supported for option databaseAuthVariableOverride");try{b(t)}catch(s){throw new Error("Invalid authOverride provided: "+s)}}n.persistentConnection_=new H(n.repoInfo_,e,(s,i,r,o)=>{Os(n,s,i,r,o)},s=>{Ms(n,s)},s=>{ca(n,s)},n.authTokenProvider_,n.appCheckProvider_,t),n.server_=n.persistentConnection_}n.authTokenProvider_.addTokenChangeListener(s=>{n.server_.refreshAuthToken(s)}),n.appCheckProvider_.addTokenChangeListener(s=>{n.server_.refreshAppCheckToken(s.token)}),n.statsReporter_=qr(n.repoInfo_,()=>new Ko(n.stats_,n.server_)),n.infoData_=new Go,n.infoSyncTree_=new As({startListening:(s,i,r,o)=>{let l=[];const a=n.infoData_.getNode(s._path);return a.isEmpty()||(l=tt(n.infoSyncTree_,s._path,a),setTimeout(()=>{o("ok")},0)),l},stopListening:()=>{}}),Xn(n,"connected",!1),n.serverSyncTree_=new As({startListening:(s,i,r,o)=>(n.server_.listen(s,r,i,(l,a)=>{const c=o(l,a);W(n.eventQueue_,s._path,c)}),[]),stopListening:(s,i)=>{n.server_.unlisten(s,i)}})}function Ki(n){const t=n.infoData_.getNode(new E(".info/serverTimeOffset")).val()||0;return new Date().getTime()+t}function rt(n){return Kl({timestamp:Ki(n)})}function Os(n,e,t,s,i){n.dataUpdateCount++;const r=new E(e);t=n.interceptServerDataCallback_?n.interceptServerDataCallback_(e,t):t;let o=[];if(i)if(s){const a=ut(t,c=>R(c));o=Vl(n.serverSyncTree_,r,a,i)}else{const a=R(t);o=Oi(n.serverSyncTree_,r,a,i)}else if(s){const a=ut(t,c=>R(c));o=Wl(n.serverSyncTree_,r,a)}else{const a=R(t);o=tt(n.serverSyncTree_,r,a)}let l=r;o.length>0&&(l=Pe(n,r)),W(n.eventQueue_,l,o)}function Ms(n,e){Xn(n,"connected",e),e===!1&&da(n)}function ca(n,e){A(e,(t,s)=>{Xn(n,t,s)})}function Xn(n,e,t){const s=new E("/.info/"+e),i=R(t);n.infoData_.updateSnapshot(s,i);const r=tt(n.infoSyncTree_,s,i);W(n.eventQueue_,s,r)}function Wt(n){return n.nextWriteId_++}function ha(n,e,t){const s=Gl(n.serverSyncTree_,e);return s!=null?Promise.resolve(s):n.server_.get(e).then(i=>{const r=R(i).withIndex(e._queryParams.getIndex());_n(n.serverSyncTree_,e,t,!0);let o;if(e._queryParams.loadsAllData())o=tt(n.serverSyncTree_,e._path,r);else{const l=je(n.serverSyncTree_,e);o=Oi(n.serverSyncTree_,e._path,r,l)}return W(n.eventQueue_,e._path,o),It(n.serverSyncTree_,e,t,null,!0),r},i=>(Me(n,"get for query "+b(e)+" failed: "+i),Promise.reject(new Error(i))))}function Jn(n,e,t,s,i){Me(n,"set",{path:e.toString(),value:t,priority:s});const r=rt(n),o=R(t,s),l=At(n.serverSyncTree_,e),a=qn(o,l,r),c=Wt(n),h=Un(n.serverSyncTree_,e,a,c,!0);Ft(n.eventQueue_,h),n.server_.put(e.toString(),o.val(!0),(d,_)=>{const p=d==="ok";p||O("set at "+e+" failed: "+d);const w=ne(n.serverSyncTree_,c,!p);W(n.eventQueue_,e,w),ce(n,i,d,_)});const u=es(n,e);Pe(n,u),W(n.eventQueue_,u,[])}function ua(n,e,t,s){Me(n,"update",{path:e.toString(),value:t});let i=!0;const r=rt(n),o={};if(A(t,(l,a)=>{i=!1,o[l]=Wi(N(e,l),R(a),n.serverSyncTree_,r)}),i)x("update() called with empty data.  Don't do anything."),ce(n,s,"ok",void 0);else{const l=Wt(n),a=Fl(n.serverSyncTree_,e,o,l);Ft(n.eventQueue_,a),n.server_.merge(e.toString(),t,(c,h)=>{const u=c==="ok";u||O("update at "+e+" failed: "+c);const d=ne(n.serverSyncTree_,l,!u),_=d.length>0?Pe(n,e):e;W(n.eventQueue_,_,d),ce(n,s,c,h)}),A(t,c=>{const h=es(n,N(e,c));Pe(n,h)}),W(n.eventQueue_,e,[])}}function da(n){Me(n,"onDisconnectEvents");const e=rt(n),t=mt();an(n.onDisconnect_,C(),(i,r)=>{const o=Wi(i,r,n.serverSyncTree_,e);De(t,i,o)});let s=[];an(t,C(),(i,r)=>{s=s.concat(tt(n.serverSyncTree_,i,r));const o=es(n,i);Pe(n,o)}),n.onDisconnect_=mt(),W(n.eventQueue_,C(),s)}function fa(n,e,t){n.server_.onDisconnectCancel(e.toString(),(s,i)=>{s==="ok"&&ln(n.onDisconnect_,e),ce(n,t,s,i)})}function Ls(n,e,t,s){const i=R(t);n.server_.onDisconnectPut(e.toString(),i.val(!0),(r,o)=>{r==="ok"&&De(n.onDisconnect_,e,i),ce(n,s,r,o)})}function _a(n,e,t,s,i){const r=R(t,s);n.server_.onDisconnectPut(e.toString(),r.val(!0),(o,l)=>{o==="ok"&&De(n.onDisconnect_,e,r),ce(n,i,o,l)})}function pa(n,e,t,s){if(Zt(t)){x("onDisconnect().update() called with empty data.  Don't do anything."),ce(n,s,"ok",void 0);return}n.server_.onDisconnectMerge(e.toString(),t,(i,r)=>{i==="ok"&&A(t,(o,l)=>{const a=R(l);De(n.onDisconnect_,N(e,o),a)}),ce(n,s,i,r)})}function ma(n,e,t){let s;g(e._path)===".info"?s=_n(n.infoSyncTree_,e,t):s=_n(n.serverSyncTree_,e,t),Qi(n.eventQueue_,e._path,s)}function mn(n,e,t){let s;g(e._path)===".info"?s=It(n.infoSyncTree_,e,t):s=It(n.serverSyncTree_,e,t),Qi(n.eventQueue_,e._path,s)}function zi(n){n.persistentConnection_&&n.persistentConnection_.interrupt(Yi)}function ga(n){n.persistentConnection_&&n.persistentConnection_.resume(Yi)}function Me(n,...e){let t="";n.persistentConnection_&&(t=n.persistentConnection_.id+":"),x(t,...e)}function ce(n,e,t,s){e&&Ae(()=>{if(t==="ok")e(null);else{const i=(t||"error").toUpperCase();let r=i;s&&(r+=": "+s);const o=new Error(r);o.code=i,e(o)}})}function ya(n,e,t,s,i,r){Me(n,"transaction on "+e);const o={path:e,update:t,onComplete:s,status:null,order:Hs(),applyLocally:r,retryCount:0,unwatcher:i,abortReason:null,currentWriteId:null,currentInputSnapshot:null,currentOutputSnapshotRaw:null,currentOutputSnapshotResolved:null},l=Zn(n,e,void 0);o.currentInputSnapshot=l;const a=o.update(l.val());if(a===void 0)o.unwatcher(),o.currentOutputSnapshotRaw=null,o.currentOutputSnapshotResolved=null,o.onComplete&&o.onComplete(null,!1,o.currentInputSnapshot);else{st("transaction failed: Data returned ",a,o.path),o.status=0;const c=Ot(n.transactionQueueTree_,e),h=Ee(c)||[];h.push(o),zn(c,h);let u;typeof a=="object"&&a!==null&&Y(a,".priority")?(u=_e(a,".priority"),f($e(u),"Invalid priority returned by transaction. Priority must be a valid string, finite number, server value, or null.")):u=(At(n.serverSyncTree_,e)||m.EMPTY_NODE).getPriority().val();const d=rt(n),_=R(a,u),p=qn(_,l,d);o.currentOutputSnapshotRaw=_,o.currentOutputSnapshotResolved=p,o.currentWriteId=Wt(n);const w=Un(n.serverSyncTree_,e,p,o.currentWriteId,o.applyLocally);W(n.eventQueue_,e,w),Ut(n,n.transactionQueueTree_)}}function Zn(n,e,t){return At(n.serverSyncTree_,e,t)||m.EMPTY_NODE}function Ut(n,e=n.transactionQueueTree_){if(e||Bt(n,e),Ee(e)){const t=$i(n,e);f(t.length>0,"Sending zero length transaction queue"),t.every(i=>i.status===0)&&va(n,nt(e),t)}else Ui(e)&&Mt(e,t=>{Ut(n,t)})}function va(n,e,t){const s=t.map(c=>c.currentWriteId),i=Zn(n,e,s);let r=i;const o=i.hash();for(let c=0;c<t.length;c++){const h=t[c];f(h.status===0,"tryToSendTransactionQueue_: items in queue should all be run."),h.status=1,h.retryCount++;const u=M(e,h.path);r=r.updateChild(u,h.currentOutputSnapshotRaw)}const l=r.val(!0),a=e;n.server_.put(a.toString(),l,c=>{Me(n,"transaction put response",{path:a.toString(),status:c});let h=[];if(c==="ok"){const u=[];for(let d=0;d<t.length;d++)t[d].status=2,h=h.concat(ne(n.serverSyncTree_,t[d].currentWriteId)),t[d].onComplete&&u.push(()=>t[d].onComplete(null,!0,t[d].currentOutputSnapshotResolved)),t[d].unwatcher();Bt(n,Ot(n.transactionQueueTree_,e)),Ut(n,n.transactionQueueTree_),W(n.eventQueue_,e,h);for(let d=0;d<u.length;d++)Ae(u[d])}else{if(c==="datastale")for(let u=0;u<t.length;u++)t[u].status===3?t[u].status=4:t[u].status=0;else{O("transaction at "+a.toString()+" failed: "+c);for(let u=0;u<t.length;u++)t[u].status=4,t[u].abortReason=c}Pe(n,e)}},o)}function Pe(n,e){const t=ji(n,e),s=nt(t),i=$i(n,t);return Ca(n,i,s),s}function Ca(n,e,t){if(e.length===0)return;const s=[];let i=[];const o=e.filter(l=>l.status===0).map(l=>l.currentWriteId);for(let l=0;l<e.length;l++){const a=e[l],c=M(t,a.path);let h=!1,u;if(f(c!==null,"rerunTransactionsUnderNode_: relativePath should not be null."),a.status===4)h=!0,u=a.abortReason,i=i.concat(ne(n.serverSyncTree_,a.currentWriteId,!0));else if(a.status===0)if(a.retryCount>=oa)h=!0,u="maxretry",i=i.concat(ne(n.serverSyncTree_,a.currentWriteId,!0));else{const d=Zn(n,a.path,o);a.currentInputSnapshot=d;const _=e[l].update(d.val());if(_!==void 0){st("transaction failed: Data returned ",_,a.path);let p=R(_);typeof _=="object"&&_!=null&&Y(_,".priority")||(p=p.updatePriority(d.getPriority()));const D=a.currentWriteId,we=rt(n),at=qn(p,d,we);a.currentOutputSnapshotRaw=p,a.currentOutputSnapshotResolved=at,a.currentWriteId=Wt(n),o.splice(o.indexOf(D),1),i=i.concat(Un(n.serverSyncTree_,a.path,at,a.currentWriteId,a.applyLocally)),i=i.concat(ne(n.serverSyncTree_,D,!0))}else h=!0,u="nodata",i=i.concat(ne(n.serverSyncTree_,a.currentWriteId,!0))}W(n.eventQueue_,t,i),i=[],h&&(e[l].status=2,(function(d){setTimeout(d,Math.floor(0))})(e[l].unwatcher),e[l].onComplete&&(u==="nodata"?s.push(()=>e[l].onComplete(null,!1,e[l].currentInputSnapshot)):s.push(()=>e[l].onComplete(new Error(u),!1,null))))}Bt(n,n.transactionQueueTree_);for(let l=0;l<s.length;l++)Ae(s[l]);Ut(n,n.transactionQueueTree_)}function ji(n,e){let t,s=n.transactionQueueTree_;for(t=g(e);t!==null&&Ee(s)===void 0;)s=Ot(s,t),e=T(e),t=g(e);return s}function $i(n,e){const t=[];return Xi(n,e,t),t.sort((s,i)=>s.order-i.order),t}function Xi(n,e,t){const s=Ee(e);if(s)for(let i=0;i<s.length;i++)t.push(s[i]);Mt(e,i=>{Xi(n,i,t)})}function Bt(n,e){const t=Ee(e);if(t){let s=0;for(let i=0;i<t.length;i++)t[i].status!==2&&(t[s]=t[i],s++);t.length=s,zn(e,t.length>0?t:void 0)}Mt(e,s=>{Bt(n,s)})}function es(n,e){const t=nt(ji(n,e)),s=Ot(n.transactionQueueTree_,e);return Xl(s,i=>{Xt(n,i)}),Xt(n,s),Bi(s,i=>{Xt(n,i)}),t}function Xt(n,e){const t=Ee(e);if(t){const s=[];let i=[],r=-1;for(let o=0;o<t.length;o++)t[o].status===3||(t[o].status===1?(f(r===o-1,"All SENT items should be at beginning of queue."),r=o,t[o].status=3,t[o].abortReason="set"):(f(t[o].status===0,"Unexpected transaction status in abort"),t[o].unwatcher(),i=i.concat(ne(n.serverSyncTree_,t[o].currentWriteId,!0)),t[o].onComplete&&s.push(t[o].onComplete.bind(null,new Error("set"),!1,null))));r===-1?zn(e,void 0):t.length=r+1,W(n.eventQueue_,nt(e),i);for(let o=0;o<s.length;o++)Ae(s[o])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ea(n){let e="";const t=n.split("/");for(let s=0;s<t.length;s++)if(t[s].length>0){let i=t[s];try{i=decodeURIComponent(i.replace(/\+/g," "))}catch{}e+="/"+i}return e}function wa(n){const e={};n.charAt(0)==="?"&&(n=n.substring(1));for(const t of n.split("&")){if(t.length===0)continue;const s=t.split("=");s.length===2?e[decodeURIComponent(s[0])]=decodeURIComponent(s[1]):O(`Invalid query segment '${t}' in query '${n}'`)}return e}const gn=function(n,e){const t=Ta(n),s=t.namespace;t.domain==="firebase.com"&&X(t.host+" is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead"),(!s||s==="undefined")&&t.domain!=="localhost"&&X("Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com"),t.secure||xr();const i=t.scheme==="ws"||t.scheme==="wss";return{repoInfo:new si(t.host,t.secure,s,i,e,"",s!==t.subdomain),path:new E(t.pathString)}},Ta=function(n){let e="",t="",s="",i="",r="",o=!0,l="https",a=443;if(typeof n=="string"){let c=n.indexOf("//");c>=0&&(l=n.substring(0,c-1),n=n.substring(c+2));let h=n.indexOf("/");h===-1&&(h=n.length);let u=n.indexOf("?");u===-1&&(u=n.length),e=n.substring(0,Math.min(h,u)),h<u&&(i=Ea(n.substring(h,u)));const d=wa(n.substring(Math.min(n.length,u)));c=e.indexOf(":"),c>=0?(o=l==="https"||l==="wss",a=parseInt(e.substring(c+1),10)):c=e.length;const _=e.slice(0,c);if(_.toLowerCase()==="localhost")t="localhost";else if(_.split(".").length<=2)t=_;else{const p=e.indexOf(".");s=e.substring(0,p).toLowerCase(),t=e.substring(p+1),r=s}"ns"in d&&(r=d.ns)}return{host:e,port:a,domain:t,subdomain:s,secure:o,scheme:l,pathString:i,namespace:r}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fs="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",Ia=(function(){let n=0;const e=[];return function(t){const s=t===n;n=t;let i;const r=new Array(8);for(i=7;i>=0;i--)r[i]=Fs.charAt(t%64),t=Math.floor(t/64);f(t===0,"Cannot push at time == 0");let o=r.join("");if(s){for(i=11;i>=0&&e[i]===63;i--)e[i]=0;e[i]++}else for(i=0;i<12;i++)e[i]=Math.floor(Math.random()*64);for(i=0;i<12;i++)o+=Fs.charAt(e[i]);return f(o.length===20,"nextPushId: Length should be 20."),o}})();/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ji{constructor(e,t,s,i){this.eventType=e,this.eventRegistration=t,this.snapshot=s,this.prevName=i}getPath(){const e=this.snapshot.ref;return this.eventType==="value"?e._path:e.parent._path}getEventType(){return this.eventType}getEventRunner(){return this.eventRegistration.getEventRunner(this)}toString(){return this.getPath().toString()+":"+this.eventType+":"+b(this.snapshot.exportVal())}}class Zi{constructor(e,t,s){this.eventRegistration=e,this.error=t,this.path=s}getPath(){return this.path}getEventType(){return"cancel"}getEventRunner(){return this.eventRegistration.getEventRunner(this)}toString(){return this.path.toString()+":cancel"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ts{constructor(e,t){this.snapshotCallback=e,this.cancelCallback=t}onValue(e,t){this.snapshotCallback.call(null,e,t)}onCancel(e){return f(this.hasCancelCallback,"Raising a cancel event on a listener with no cancel callback"),this.cancelCallback.call(null,e)}get hasCancelCallback(){return!!this.cancelCallback}matches(e){return this.snapshotCallback===e.snapshotCallback||this.snapshotCallback.userCallback!==void 0&&this.snapshotCallback.userCallback===e.snapshotCallback.userCallback&&this.snapshotCallback.context===e.snapshotCallback.context}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sa{constructor(e,t){this._repo=e,this._path=t}cancel(){const e=new B;return fa(this._repo,this._path,e.wrapCallback(()=>{})),e.promise}remove(){j("OnDisconnect.remove",this._path);const e=new B;return Ls(this._repo,this._path,null,e.wrapCallback(()=>{})),e.promise}set(e){j("OnDisconnect.set",this._path),J("OnDisconnect.set",e,this._path,!1);const t=new B;return Ls(this._repo,this._path,e,t.wrapCallback(()=>{})),t.promise}setWithPriority(e,t){j("OnDisconnect.setWithPriority",this._path),J("OnDisconnect.setWithPriority",e,this._path,!1),jn("OnDisconnect.setWithPriority",t);const s=new B;return _a(this._repo,this._path,e,t,s.wrapCallback(()=>{})),s.promise}update(e){j("OnDisconnect.update",this._path),Gi("OnDisconnect.update",e,this._path);const t=new B;return pa(this._repo,this._path,e,t.wrapCallback(()=>{})),t.promise}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class U{constructor(e,t,s,i){this._repo=e,this._path=t,this._queryParams=s,this._orderByCalled=i}get key(){return y(this._path)?null:In(this._path)}get ref(){return new K(this._repo,this._path)}get _queryIdentifier(){const e=ws(this._queryParams),t=Cn(e);return t==="{}"?"default":t}get _queryObject(){return ws(this._queryParams)}isEqual(e){if(e=F(e),!(e instanceof U))return!1;const t=this._repo===e._repo,s=Sn(this._path,e._path),i=this._queryIdentifier===e._queryIdentifier;return t&&s&&i}toJSON(){return this.toString()}toString(){return this._repo.toString()+po(this._path)}}function Vt(n,e){if(n._orderByCalled===!0)throw new Error(e+": You can't combine multiple orderBy calls.")}function he(n){let e=null,t=null;if(n.hasStart()&&(e=n.getIndexStartValue()),n.hasEnd()&&(t=n.getIndexEndValue()),n.getIndex()===$){const s="Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().",i="Query: When ordering by key, the argument passed to startAt(), startAfter(), endAt(), endBefore(), or equalTo() must be a string.";if(n.hasStart()){if(n.getIndexStartName()!==re)throw new Error(s);if(typeof e!="string")throw new Error(i)}if(n.hasEnd()){if(n.getIndexEndName()!==ee)throw new Error(s);if(typeof t!="string")throw new Error(i)}}else if(n.getIndex()===S){if(e!=null&&!$e(e)||t!=null&&!$e(t))throw new Error("Query: When ordering by priority, the first argument passed to startAt(), startAfter() endAt(), endBefore(), or equalTo() must be a valid priority value (null, a number, or a string).")}else if(f(n.getIndex()instanceof bn||n.getIndex()===kn,"unknown index type."),e!=null&&typeof e=="object"||t!=null&&typeof t=="object")throw new Error("Query: First argument passed to startAt(), startAfter(), endAt(), endBefore(), or equalTo() cannot be an object.")}function Gt(n){if(n.hasStart()&&n.hasEnd()&&n.hasLimit()&&!n.hasAnchoredLimit())throw new Error("Query: Can't combine startAt(), startAfter(), endAt(), endBefore(), and limit(). Use limitToFirst() or limitToLast() instead.")}class K extends U{constructor(e,t){super(e,t,new xn,!1)}get parent(){const e=di(this._path);return e===null?null:new K(this._repo,e)}get root(){let e=this;for(;e.parent!==null;)e=e.parent;return e}}class ye{constructor(e,t,s){this._node=e,this.ref=t,this._index=s}get priority(){return this._node.getPriority().val()}get key(){return this.ref.key}get size(){return this._node.numChildren()}child(e){const t=new E(e),s=xe(this.ref,e);return new ye(this._node.getChild(t),s,S)}exists(){return!this._node.isEmpty()}exportVal(){return this._node.val(!0)}forEach(e){return this._node.isLeafNode()?!1:!!this._node.forEachChild(this._index,(s,i)=>e(new ye(i,xe(this.ref,s),S)))}hasChild(e){const t=new E(e);return!this._node.getChild(t).isEmpty()}hasChildren(){return this._node.isLeafNode()?!1:!this._node.isEmpty()}toJSON(){return this.exportVal()}val(){return this._node.val()}}function Na(n,e){return n=F(n),n._checkNotDeleted("ref"),e!==void 0?xe(n._root,e):n._root}function za(n,e){n=F(n),n._checkNotDeleted("refFromURL");const t=gn(e,n._repo.repoInfo_.nodeAdmin);Hi("refFromURL",t);const s=t.repoInfo;return!n._repo.repoInfo_.isCustomHost()&&s.host!==n._repo.repoInfo_.host&&X("refFromURL: Host name does not match the current database: (found "+s.host+" but expected "+n._repo.repoInfo_.host+")"),Na(n,t.path.toString())}function xe(n,e){return n=F(n),g(n._path)===null?sa("child","path",e,!1):$n("child","path",e,!1),new K(n._repo,N(n._path,e))}function ja(n){return n=F(n),new Sa(n._repo,n._path)}function $a(n,e){n=F(n),j("push",n._path),J("push",e,n._path,!0);const t=Ki(n._repo),s=Ia(t),i=xe(n,s),r=xe(n,s);let o;return e!=null?o=er(r,e).then(()=>r):o=Promise.resolve(r),i.then=o.then.bind(o),i.catch=o.then.bind(o,void 0),i}function Xa(n){return j("remove",n._path),er(n,null)}function er(n,e){n=F(n),j("set",n._path),J("set",e,n._path,!1);const t=new B;return Jn(n._repo,n._path,e,null,t.wrapCallback(()=>{})),t.promise}function Ja(n,e){n=F(n),j("setPriority",n._path),jn("setPriority",e);const t=new B;return Jn(n._repo,N(n._path,".priority"),e,null,t.wrapCallback(()=>{})),t.promise}function Za(n,e,t){if(j("setWithPriority",n._path),J("setWithPriority",e,n._path,!1),jn("setWithPriority",t),n.key===".length"||n.key===".keys")throw"setWithPriority failed: "+n.key+" is a read-only object.";const s=new B;return Jn(n._repo,n._path,e,t,s.wrapCallback(()=>{})),s.promise}function ec(n,e){Gi("update",e,n._path);const t=new B;return ua(n._repo,n._path,e,t.wrapCallback(()=>{})),t.promise}function tc(n){n=F(n);const e=new ts(()=>{}),t=new ot(e);return ha(n._repo,n,t).then(s=>new ye(s,new K(n._repo,n._path),n._queryParams.getIndex()))}class ot{constructor(e){this.callbackContext=e}respondsTo(e){return e==="value"}createEvent(e,t){const s=t._queryParams.getIndex();return new Ji("value",this,new ye(e.snapshotNode,new K(t._repo,t._path),s))}getEventRunner(e){return e.getEventType()==="cancel"?()=>this.callbackContext.onCancel(e.error):()=>this.callbackContext.onValue(e.snapshot,null)}createCancelEvent(e,t){return this.callbackContext.hasCancelCallback?new Zi(this,e,t):null}matches(e){return e instanceof ot?!e.callbackContext||!this.callbackContext?!0:e.callbackContext.matches(this.callbackContext):!1}hasAnyCallback(){return this.callbackContext!==null}}class Ht{constructor(e,t){this.eventType=e,this.callbackContext=t}respondsTo(e){let t=e==="children_added"?"child_added":e;return t=t==="children_removed"?"child_removed":t,this.eventType===t}createCancelEvent(e,t){return this.callbackContext.hasCancelCallback?new Zi(this,e,t):null}createEvent(e,t){f(e.childName!=null,"Child events should have a childName.");const s=xe(new K(t._repo,t._path),e.childName),i=t._queryParams.getIndex();return new Ji(e.type,this,new ye(e.snapshotNode,s,i),e.prevName)}getEventRunner(e){return e.getEventType()==="cancel"?()=>this.callbackContext.onCancel(e.error):()=>this.callbackContext.onValue(e.snapshot,e.prevName)}matches(e){return e instanceof Ht?this.eventType===e.eventType&&(!this.callbackContext||!e.callbackContext||this.callbackContext.matches(e.callbackContext)):!1}hasAnyCallback(){return!!this.callbackContext}}function lt(n,e,t,s,i){let r;if(typeof s=="object"&&(r=void 0,i=s),typeof s=="function"&&(r=s),i&&i.onlyOnce){const a=t,c=(h,u)=>{mn(n._repo,n,l),a(h,u)};c.userCallback=t.userCallback,c.context=t.context,t=c}const o=new ts(t,r||void 0),l=e==="value"?new ot(o):new Ht(e,o);return ma(n._repo,n,l),()=>mn(n._repo,n,l)}function Ra(n,e,t,s){return lt(n,"value",e,t,s)}function nc(n,e,t,s){return lt(n,"child_added",e,t,s)}function sc(n,e,t,s){return lt(n,"child_changed",e,t,s)}function ic(n,e,t,s){return lt(n,"child_moved",e,t,s)}function rc(n,e,t,s){return lt(n,"child_removed",e,t,s)}function oc(n,e,t){let s=null;const i=t?new ts(t):null;e==="value"?s=new ot(i):e&&(s=new Ht(e,i)),mn(n._repo,n,s)}class z{}class tr extends z{constructor(e,t){super(),this._value=e,this._key=t,this.type="endAt"}_apply(e){J("endAt",this._value,e._path,!0);const t=on(e._queryParams,this._value,this._key);if(Gt(t),he(t),e._queryParams.hasEnd())throw new Error("endAt: Starting point was already set (by another call to endAt, endBefore or equalTo).");return new U(e._repo,e._path,t,e._orderByCalled)}}function lc(n,e){return it("endAt","key",e),new tr(n,e)}class ba extends z{constructor(e,t){super(),this._value=e,this._key=t,this.type="endBefore"}_apply(e){J("endBefore",this._value,e._path,!1);const t=Vo(e._queryParams,this._value,this._key);if(Gt(t),he(t),e._queryParams.hasEnd())throw new Error("endBefore: Starting point was already set (by another call to endAt, endBefore or equalTo).");return new U(e._repo,e._path,t,e._orderByCalled)}}function ac(n,e){return it("endBefore","key",e),new ba(n,e)}class nr extends z{constructor(e,t){super(),this._value=e,this._key=t,this.type="startAt"}_apply(e){J("startAt",this._value,e._path,!0);const t=rn(e._queryParams,this._value,this._key);if(Gt(t),he(t),e._queryParams.hasStart())throw new Error("startAt: Starting point was already set (by another call to startAt, startBefore or equalTo).");return new U(e._repo,e._path,t,e._orderByCalled)}}function cc(n=null,e){return it("startAt","key",e),new nr(n,e)}class ka extends z{constructor(e,t){super(),this._value=e,this._key=t,this.type="startAfter"}_apply(e){J("startAfter",this._value,e._path,!1);const t=Bo(e._queryParams,this._value,this._key);if(Gt(t),he(t),e._queryParams.hasStart())throw new Error("startAfter: Starting point was already set (by another call to startAt, startAfter, or equalTo).");return new U(e._repo,e._path,t,e._orderByCalled)}}function hc(n,e){return it("startAfter","key",e),new ka(n,e)}class Pa extends z{constructor(e){super(),this._limit=e,this.type="limitToFirst"}_apply(e){if(e._queryParams.hasLimit())throw new Error("limitToFirst: Limit was already set (by another call to limitToFirst or limitToLast).");return new U(e._repo,e._path,Wo(e._queryParams,this._limit),e._orderByCalled)}}function uc(n){if(typeof n!="number"||Math.floor(n)!==n||n<=0)throw new Error("limitToFirst: First argument must be a positive integer.");return new Pa(n)}class xa extends z{constructor(e){super(),this._limit=e,this.type="limitToLast"}_apply(e){if(e._queryParams.hasLimit())throw new Error("limitToLast: Limit was already set (by another call to limitToFirst or limitToLast).");return new U(e._repo,e._path,Uo(e._queryParams,this._limit),e._orderByCalled)}}function dc(n){if(typeof n!="number"||Math.floor(n)!==n||n<=0)throw new Error("limitToLast: First argument must be a positive integer.");return new xa(n)}class Aa extends z{constructor(e){super(),this._path=e,this.type="orderByChild"}_apply(e){Vt(e,"orderByChild");const t=new E(this._path);if(y(t))throw new Error("orderByChild: cannot pass in empty path. Use orderByValue() instead.");const s=new bn(t),i=bt(e._queryParams,s);return he(i),new U(e._repo,e._path,i,!0)}}function fc(n){if(n==="$key")throw new Error('orderByChild: "$key" is invalid.  Use orderByKey() instead.');if(n==="$priority")throw new Error('orderByChild: "$priority" is invalid.  Use orderByPriority() instead.');if(n==="$value")throw new Error('orderByChild: "$value" is invalid.  Use orderByValue() instead.');return $n("orderByChild","path",n,!1),new Aa(n)}class Da extends z{constructor(){super(...arguments),this.type="orderByKey"}_apply(e){Vt(e,"orderByKey");const t=bt(e._queryParams,$);return he(t),new U(e._repo,e._path,t,!0)}}function _c(){return new Da}class Oa extends z{constructor(){super(...arguments),this.type="orderByPriority"}_apply(e){Vt(e,"orderByPriority");const t=bt(e._queryParams,S);return he(t),new U(e._repo,e._path,t,!0)}}function pc(){return new Oa}class Ma extends z{constructor(){super(...arguments),this.type="orderByValue"}_apply(e){Vt(e,"orderByValue");const t=bt(e._queryParams,kn);return he(t),new U(e._repo,e._path,t,!0)}}function mc(){return new Ma}class La extends z{constructor(e,t){super(),this._value=e,this._key=t,this.type="equalTo"}_apply(e){if(J("equalTo",this._value,e._path,!1),e._queryParams.hasStart())throw new Error("equalTo: Starting point was already set (by another call to startAt/startAfter or equalTo).");if(e._queryParams.hasEnd())throw new Error("equalTo: Ending point was already set (by another call to endAt/endBefore or equalTo).");return new tr(this._value,this._key)._apply(new nr(this._value,this._key)._apply(e))}}function gc(n,e){return it("equalTo","key",e),new La(n,e)}function yc(n,...e){let t=F(n);for(const s of e)t=s._apply(t);return t}kl(K);Ol(K);/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fa="FIREBASE_DATABASE_EMULATOR_HOST",yn={};let sr=!1;function Wa(n,e,t,s){const i=e.lastIndexOf(":"),r=e.substring(0,i),o=Us(r);n.repoInfo_=new si(e,o,n.repoInfo_.namespace,n.repoInfo_.webSocketOnly,n.repoInfo_.nodeAdmin,n.repoInfo_.persistenceKey,n.repoInfo_.includeNamespaceInQueryParams,!0,t),s&&(n.authTokenProvider_=s)}function ir(n,e,t,s,i){let r=s||n.options.databaseURL;r===void 0&&(n.options.projectId||X("Can't determine Firebase Database URL. Be sure to include  a Project ID when calling firebase.initializeApp()."),x("Using default host for project ",n.options.projectId),r=`${n.options.projectId}-default-rtdb.firebaseio.com`);let o=gn(r,i),l=o.repoInfo,a,c;typeof process<"u"&&is&&(c=is[Fa]),c?(a=!0,r=`http://${c}?ns=${l.namespace}`,o=gn(r,i),l=o.repoInfo):a=!o.repoInfo.secure;const h=i&&a?new Se(Se.OWNER):new Gr(n.name,n.options,e);Hi("Invalid Firebase Database URL",o),y(o.path)||X("Database URL must point to the root of a Firebase Database (not including a child path).");const u=Ba(l,n,h,new Vr(n,t));return new Ga(u,n)}function Ua(n,e){const t=yn[e];(!t||t[n.key]!==n)&&X(`Database ${e}(${n.repoInfo_}) has already been deleted.`),zi(n),delete t[n.key]}function Ba(n,e,t,s){let i=yn[e.name];i||(i={},yn[e.name]=i);let r=i[n.toURLString()];return r&&X("Database initialized multiple times. Please make sure the format of the database URL matches with each database() call."),r=new la(n,sr,t,s),i[n.toURLString()]=r,r}function Va(n){sr=n}class Ga{constructor(e,t){this._repoInternal=e,this.app=t,this.type="database",this._instanceStarted=!1}get _repo(){return this._instanceStarted||(aa(this._repoInternal,this.app.options.appId,this.app.options.databaseAuthVariableOverride),this._instanceStarted=!0),this._repoInternal}get _root(){return this._rootInternal||(this._rootInternal=new K(this._repo,C())),this._rootInternal}_delete(){return this._rootInternal!==null&&(Ua(this._repo,this.app.name),this._repoInternal=null,this._rootInternal=null),Promise.resolve()}_checkNotDeleted(e){this._rootInternal===null&&X("Cannot call "+e+" on a deleted database.")}}function rr(){Ne.IS_TRANSPORT_INITIALIZED&&O("Transport has already been initialized. Please call this function before calling ref or setting up a listener")}function vc(){rr(),te.forceDisallow()}function Cc(){rr(),V.forceDisallow(),te.forceAllow()}function Ec(n=Nr(),e){const t=Ir(n,"database").getImmediate({identifier:e});if(!t._instanceStarted){const s=Sr("database");s&&Ha(t,...s)}return t}function Ha(n,e,t,s={}){n=F(n),n._checkNotDeleted("useEmulator");const i=`${e}:${t}`,r=n._repoInternal;if(n._instanceStarted){if(i===n._repoInternal.repoInfo_.host&&Er(s,r.repoInfo_.emulatorOptions))return;X("connectDatabaseEmulator() cannot initialize or alter the emulator configuration after the database instance has started.")}let o;if(r.repoInfo_.nodeAdmin)s.mockUserToken&&X('mockUserToken is not supported by the Admin SDK. For client access with mock users, please use the "firebase" package instead of "firebase-admin".'),o=new Se(Se.OWNER);else if(s.mockUserToken){const l=typeof s.mockUserToken=="string"?s.mockUserToken:wr(s.mockUserToken,n.app.options.projectId);o=new Se(l)}Us(e)&&Tr(e),Wa(r,i,s,o)}function wc(n){n=F(n),n._checkNotDeleted("goOffline"),zi(n._repo)}function Tc(n){n=F(n),n._checkNotDeleted("goOnline"),ga(n._repo)}function Ic(n,e){qs(n,e)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qa(n){Vs(br),ar(new Jt("database",(e,{instanceIdentifier:t})=>{const s=e.getProvider("app").getImmediate(),i=e.getProvider("auth-internal"),r=e.getProvider("app-check-internal");return ir(s,i,r,t)},"PUBLIC").setMultipleInstances(!0)),ns(rs,os,n),ns(rs,os,"esm2020")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qa={".sv":"timestamp"};function Sc(){return qa}function Nc(n){return{".sv":{increment:n}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ya{constructor(e,t){this.committed=e,this.snapshot=t}toJSON(){return{committed:this.committed,snapshot:this.snapshot.toJSON()}}}function Rc(n,e,t){if(n=F(n),j("Reference.transaction",n._path),n.key===".length"||n.key===".keys")throw"Reference.transaction failed: "+n.key+" is a read-only object.";const s=(t==null?void 0:t.applyLocally)??!0,i=new B,r=(l,a,c)=>{let h=null;l?i.reject(l):(h=new ye(c,new K(n._repo,n._path),S),i.resolve(new Ya(a,h)))},o=Ra(n,()=>{});return ya(n._repo,n._path,e,r,o,s),i.promise}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */H.prototype.simpleListen=function(n,e){this.sendRequest("q",{p:n},e)};H.prototype.echo=function(n,e){this.sendRequest("echo",{d:n},e)};const bc=function(n){const e=H.prototype.put;return H.prototype.put=function(t,s,i,r){r!==void 0&&(r=n()),e.call(this,t,s,i,r)},function(){H.prototype.put=e}},kc=function(n){Va(n)};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pc({app:n,url:e,version:t,customAuthImpl:s,customAppCheckImpl:i,nodeAdmin:r=!1}){Vs(t);const o=new Rr("database-standalone"),l=new ss("auth-internal",o);let a;return i&&(a=new ss("app-check-internal",o),a.setComponent(new Jt("app-check-internal",()=>i,"PRIVATE"))),l.setComponent(new Jt("auth-internal",()=>s,"PRIVATE")),ir(n,l,a,e,r)}Qa();export{ec as $,sc as A,ic as B,rc as C,ye as D,ja as E,Ra as F,fc as G,_c as H,pc as I,mc as J,$a as K,yc as L,Na as M,za as N,Sa as O,Xa as P,z as Q,K as R,Rc as S,Ya as T,Sc as U,er as V,Ja as W,Za as X,hc as Y,cc as Z,Pc as _,Ga as a,U as b,xn as c,j as d,xe as e,kc as f,Ha as g,bc as h,Ic as i,lc as j,ac as k,gc as l,Cc as m,vc as n,tc as o,Ec as p,wc as q,ir as r,Vs as s,Tc as t,Nc as u,$n as v,uc as w,dc as x,oc as y,nc as z};
