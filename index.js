///////////// 配置 //////////
const prefix = "sp."                // 类名前缀, 防止污染已存在的声明
const inpath = "all.sproto"         // 合并后的sproto文件
const outpath = "./emmy_sproto.lua" //生成的lua注解文件
///////////////////////////

const path = require("path")
const vm = require("./skynet.vm")
const fs = require("fs")
const lua = new vm.Lua.State()
let strProto = fs.readFileSync(path.resolve(inpath),'utf8')

let [strRet] = lua.execute(`
    _G.sproto = dofile('sproto.lua')
    _G.sprotoparser = dofile('sprotoparser.lua')
    _G.sprotoloader = dofile('sprotoloader.lua')
    _G.dkjson = dofile('dkjson.lua')
    local str = crypt.hexdecode('${Buffer.from(strProto).toString('hex')}')
    _G.sp = sproto.parse(str)
    local t,p = sproto_core.info(sp.__cobj)
    host = sp:host "package"
    request = host:attach(sp)
    return dkjson.encode({t=t,p=p})
`);

let sp = JSON.parse(strRet)

function sprotoType2EmmyType(type) {
    if(type == "integer") return "number"
    else if(type == "double") return "number"
    else if(type == "binary") return "string"
    return type
}

let out = ""

// 生成type注解
let t = sp.t
for(let k in t){
    let obj = t[k]
    out += `\n---@class ${prefix}${k}\n`
    for(let f in obj) {
        let field = obj[f]
        let emmyType = sprotoType2EmmyType(field.type)
        out += `---@field ${f} `
        if(field.array) {
            if(field.key == undefined)
                out += `${emmyType}[]\n`
            else {
                let subobj = t[field.type]
                let subType
                for(let sf in subobj) {
                    let subField = subobj[sf]
                    if(subField.tag == field.key)
                        subType = subField.type
                }
                subType = sprotoType2EmmyType(subType)
                out += `table<${subType}, ${emmyType}>\n`
            }
        } else {
            out += `${emmyType}\n`
        }
    }
}

// 生成protocol注解
let p = sp.p
for(let k in p) {
    let obj = p[k]
    out += `\n---@class ${prefix}${k}\n`
    if(obj.request)
        out += `---@field request ${obj.request}\n`
    if(obj.response)
        out += `---@field response ${obj.response}\n`
}

fs.writeFileSync(outpath, out)