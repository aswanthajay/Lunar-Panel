import{r as e}from"./rolldown-runtime-hePW80VL.js";import{n as t,t as n}from"./jsx-runtime-096o_Uk7.js";var r=e(t(),1),i=n(),a=({className:e=``,theme:t,speedSeconds:n=3.6,fontSize:a=15,height:o=31})=>{let[s,c]=(0,r.useState)(()=>t||(typeof document<`u`?document.documentElement.getAttribute(`data-theme`)===`dark`||document.documentElement.classList.contains(`dark`)?`dark`:`light`:`dark`));(0,r.useEffect)(()=>{if(t){c(t);return}let e=()=>{let e=document.documentElement.getAttribute(`data-theme`)===`dark`||document.documentElement.classList.contains(`dark`);c(e?`dark`:`light`)};e();let n=new MutationObserver(e);return n.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`,`class`]}),window.addEventListener(`votion:theme-change`,e),()=>{n.disconnect(),window.removeEventListener(`votion:theme-change`,e)}},[t]);let l=s===`dark`;return(0,i.jsxs)(`div`,{className:`votion-comet-logo ${e}`,style:{position:`relative`,height:`${o}px`,boxSizing:`border-box`,padding:`3px`,backgroundColor:l?`#3f3f46`:`#1a1a1a`,display:`inline-flex`,alignItems:`center`,justifyContent:`center`,overflow:`hidden`,userSelect:`none`,lineHeight:1,flexShrink:0},children:[(0,i.jsx)(`span`,{style:{position:`absolute`,top:`-150%`,left:`-150%`,width:`400%`,height:`400%`,pointerEvents:`none`,zIndex:1,background:`conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 285deg,
            rgba(255, 255, 255, 0.04) 292deg,
            rgba(255, 255, 255, 0.15) 315deg,
            rgba(255, 255, 255, 0.40) 338deg,
            rgba(255, 255, 255, 0.80) 352deg,
            rgba(255, 255, 255, 0.98) 358deg,
            #FFFFFF 359deg,
            #FFFFFF 360deg
          )`,animation:`cometGlide ${n}s linear infinite`}}),(0,i.jsx)(`span`,{style:{position:`relative`,zIndex:2,height:`100%`,width:`100%`,backgroundColor:l?`#0a0a0a`:`#ffffff`,color:l?`#ededed`:`#1a1a1a`,padding:`0 11px`,display:`flex`,alignItems:`center`,justifyContent:`center`,fontFamily:`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif`,fontSize:`${a}px`,fontWeight:800,letterSpacing:`-0.04em`,textTransform:`lowercase`,lineHeight:1,boxShadow:l?`inset 0 0 0 1px rgba(255, 255, 255, 0.04)`:`inset 0 0 0 1px rgba(0, 0, 0, 0.04)`},children:`votion`}),(0,i.jsx)(`style`,{children:`
        @keyframes cometGlide {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `})]})};export{a as t};