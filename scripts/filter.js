(function(){
const BANNED_PATTERNS = {
    domains: [
        '\\.onion\\b',
        'torproject\\.org',
        'tor2web\\.org',
        'darknet',
        'darkweb',
        'roks\\.click',
        'wikiless\\.org'
    ],
    illegal: [
        '\\bcp\\b',
        'childporn',
        'child.?porn',
        'loli',
        'lolicon',
        'pedo',
        'pedophile',
        'pedophilia',
        'cpid',
        'redroom',
        'red room',
        'redroom',
        'kidnap',
        'kidnapping',
        'human trafficking',
        'trafficking',
        'cannabis',
        'marijuana',
        'weed',
        'meth',
        'methamphetamine',
        'cocaine',
        'heroin',
        'lsd',
        'mdma',
        'ecstasy',
        'darkmarket',
        'hydra market',
        'silk road',
        'carding',
        'cvvs?hop',
        'dumpss?hop',
        'fraudshop',
        'hacking service',
        'bomb making',
        'explosive',
        'detonate',
        'ransom',
        'nuclear',
        'biological weapon',
        'chemical weapon',
        'weapons? of mass',
        'mass destruction',
        'hitman',
        'contract killer'
    ],
    allowedWeapons: []
};

const ALLOWED_DOMAINS = [
    'imgur\\.com',
    'i\\.imgur\\.com',
    'youtube\\.com',
    'youtu\\.be',
    'www\\.youtube\\.com',
    'm\\.youtube\\.com',
    'imgur\\.io',
    'i\\.imgur\\.io'
];

function isAllowedDomain(url){
    if(!url)return true;
    const lowerUrl=url.toLowerCase();
    for(const domain of ALLOWED_DOMAINS){
        if(new RegExp(domain,'i').test(lowerUrl)){
            return true;
        }
    }
    return false;
}

function containsBannedPattern(text){
    if(!text)return false;
    const lowerText=text.toLowerCase();
    for(const pattern of BANNED_PATTERNS.domains){
        if(new RegExp(pattern,'i').test(lowerText)){
            return true;
        }
    }
    for(const pattern of BANNED_PATTERNS.illegal){
        if(new RegExp(pattern,'i').test(lowerText)){
            return true;
        }
    }
    return false;
}

function checkImageUrl(url){
    if(!url)return true;
    if(url.startsWith('data:image'))return true;
    if(!isAllowedDomain(url)){
        console.warn('Заблокирован домен:',url);
        return false;
    }
    return true;
}

function filterContent(text){
    if(containsBannedPattern(text)){
        return '[СООБЩЕНИЕ ЗАБЛОКИРОВАНО МОДЕРАЦИЕЙ]';
    }
    return text;
}

function validatePost(subject, comment, imageUrl){
    const fullText=(subject||'')+' '+(comment||'');
    if(containsBannedPattern(fullText)){
        return{valid:false,reason:'Обнаружен запрещённый контент.'};
    }
    if(imageUrl && !checkImageUrl(imageUrl)){
        return{valid:false,reason:'Разрешены только изображения с Imgur и видео с YouTube'};
    }
    return{valid:true,reason:''};
}

window.contentFilter={
    validatePost:validatePost,
    filterContent:filterContent,
    checkImageUrl:checkImageUrl,
    isAllowedDomain:isAllowedDomain,
    containsBannedPattern:containsBannedPattern
};
})();
