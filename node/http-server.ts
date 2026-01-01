const downloads = './Fishbones_Data'
const routes = new Map([
    'playable_client_126.7z',
    'modded_levels_paste_on_client.7z',
    'ChildrenOfTheGrave-Gameserver.7z',
].map(fileName => {
    return [ `/${fileName}`, Bun.file(`${downloads}/${fileName}`) ]
}))

const server = Bun.serve({
    hostname: '0.0.0.0',
    fetch(req) {

        const url = new URL(req.url)
        const file = routes.get(url.pathname)
        if(!file){
            return new Response("File not found", { status: 404 })
        }

        let start = 0, end = Infinity
        const rangeHeader = req.headers.get('range')
        if(typeof rangeHeader === 'string'){
            const parts = rangeHeader.split('=').at(-1)?.split('-').map(n => parseInt(n, 10))
            if(parts?.[0]) start = parts[0]
            if(parts?.[1]) end = parts[1]
        }
        if(start != 0 || isFinite(end)){
            start = Math.max(0, start)
            end = Math.min(end, file.size - 1)
            //console.log('request', start, end)
            return new Response(file.slice(start, end + 1, 'application/x-7z-compressed'), {
                headers: {
                    // https://github.com/oven-sh/bun/issues/17563
                    "Content-Range": `bytes ${start}-${end}/${file.size}`,
                    "Content-Length": (end - start + 1).toString(),
                },
            })
        } else {
            return new Response(file)
        }
    },
})

console.log(`Process ${process.pid} listening on ${server.url}`)
