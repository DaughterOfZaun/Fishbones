
console.log('begin')

const s1 = ctx.create_socket()
s1.connect(new UTPAddress(AddressFamily.INET, '127.0.0.1', 9000))
s1.shutdown(UTPShutdown.SHUT_RDWR)
s1.close()
ctx.destroy()

console.log('end')
