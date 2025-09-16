const showStyle=  document.getElementById("showstyle");
const fontSize = document.querySelector('.font-size');
const textColor = document.querySelector('.text-color');
const bgColor = document.querySelector('.bg-color');
const boldBtn = document.querySelector('.bold');
const italicBtn = document.querySelector('.italic');
const underlineBtn = document.querySelector('.underline');
const fontFamily = document.querySelector('.font-family');
const fontClassList = document.querySelector('.font-class-list');
const fontCase = document.querySelector('.font-case');

let selectedElement = null;

let isCtrlPressed = false;
let mutipleSelect=[];

document.addEventListener('keydown', (e) => {
    if(e.key === "Control" && !isCtrlPressed){
        isCtrlPressed = true;
        console.log('Ctrl key is pressed');
         mutipleSelect.forEach(el => el.style.outline ='none' );
             mutipleSelect=[];
    }
});

document.addEventListener('keyup', (e) => {
    if(e.key === "Control"){
        isCtrlPressed = false;
       console.log(mutipleSelect);
       

    }
});


// Convert rgb to hex
function rgbToHex(rgb){
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if(!m) return "#000000";
  return "#" + ((1<<24)+(parseInt(m[1])<<16)+(parseInt(m[2])<<8)+parseInt(m[3])).toString(16).slice(1);
}

// Update toolbar when element selected
function sendElement(tag){
  selectedElement = tag;
  showStyle.style.bottom ='0px' ;
  if(isCtrlPressed){
    if(tag){
         mutipleSelect.push(tag);
        tag.style.outline ='2px dotted blue' ;}
        }
           
        
  

  const style = getComputedStyle(tag);
  const currentFont = style.fontFamily;

    let exists = Array.from(fontFamily.options).some(opt => opt.value === currentFont);
    if(!exists){
        // Add new font dynamically
        const opt = document.createElement('option');
        opt.value = currentFont;
        opt.textContent = currentFont;
        opt.style.fontFamily = currentFont;
        fontFamily.appendChild(opt);
    }else{
            fontFamily.value = style.fontFamily;}

  fontSize.value = parseInt(style.fontSize);
  fontCase.value = (style.textTransform === ""&&style.textTransform === "none") ? "none" : style.textTransform;
  textColor.value = rgbToHex(style.color);
  bgColor.value = rgbToHex(style.backgroundColor);
  console.log(style.fontSize, style.color, style.backgroundColor);
  boldBtn.classList.toggle('active', style.fontWeight === "700" || style.fontWeight === "bold");
  italicBtn.classList.toggle('active', style.fontStyle === "italic");
  underlineBtn.classList.toggle('active', style.textDecoration.includes("underline"));
}

// Apply toolbar changes to selected element

fontFamily.addEventListener('input', () => {
    applyStyle('fontFamily', fontFamily.value);
});

fontSize.addEventListener('input', () => {
    applyStyle('fontSize', fontSize.value + "px");
});

textColor.addEventListener('input', () => {
    applyStyle('color', textColor.value);
});

bgColor.addEventListener('input', () => {
    applyStyle('backgroundColor', bgColor.value);
});
fontCase.addEventListener('input', () => {
    applyStyle('textTransform', fontCase.value);
});




boldBtn.addEventListener('click', ()=>{
  if(!selectedElement) return;
  const active = boldBtn.classList.toggle('active');
  applyStyle('fontWeight' ,(active ? 'bold' : 'normal'));
});
italicBtn.addEventListener('click', ()=>{
  if(!selectedElement) return;
  const active = italicBtn.classList.toggle('active');
  applyStyle('fontStyle', active ? 'italic' : 'normal');
});

underlineBtn.addEventListener('click', ()=>{
  if(!selectedElement) return;
  const active = underlineBtn.classList.toggle('active');
  applyStyle('textDecoration', active ? 'underline' : 'none');
});

function applyStyle(property, value){
     if(mutipleSelect.length>0){ mutipleSelect.forEach(element => {
        element.style[property] = value;
    });}else{  selectedElement.style[property] = value;

    }

    console.log(`Style changed: ${property} = ${value}`);
}


function fontStyleUp(){
  if( showStyle.style.bottom == '-80px'){ 
         showStyle.style.bottom ='0px' ;
         showStyle.querySelector('svg').style.transform ='rotate(180deg)';
         }else{
        showStyle.style.bottom ='-80px' ;
        showStyle.querySelector('svg').style.transform ='rotate(0deg)';
    }


}


function editfun(a, el) {
    document.getElementById("showDataEdit").style.display = 'none';
    document.getElementById("showimg").style.display = 'none';
    document.getElementById("showstyle").style.display = 'none';
    

    document.getElementById(a).style.display = 'grid';
    if(a=='showDataEdit'){
        document.getElementById("showstyle").style.display = 'block';
    }
    document.querySelector('.text').classList.remove('active');
    document.querySelector('.img').classList.remove('active');
   
    el.classList.add('active');




}
