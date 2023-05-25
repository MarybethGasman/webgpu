


// 文档的canvas元素作为画布
const [vertShader, fragShader] = await Promise.all([
    fetch('life.vert.wgsl').then(res => res.text()),
    fetch('life.frag.wgsl').then(res => res.text())
]);

// console.log(vertShader, fragShader);

const canvas = document.querySelector('canvas')
if (!navigator.gpu) {
    throw new Error('WebGPU not supported on this browser.')
}
const adapter = await navigator.gpu.requestAdapter()
if (!adapter) {
    throw new Error('No appropriate GPUAdapter found.')
}
// console.log(adapter);
export const device = await adapter.requestDevice()
// console.log(device);
export const context = canvas.getContext('webgpu')
export const canvasFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({
    device: device,
    format: canvasFormat,
})
export const encoder = device.createCommandEncoder()
export const vertices = new Float32Array([
    -0.8, -0.8,
    0.8, -0.8,
    0.8, 0.8,

    -0.8, -0.8,
    0.8, 0.8,
    -0.8, 0.8,

])

export const vertexBuffer = device.createBuffer({
    label: 'Cell vertices',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
})

device.queue.writeBuffer(vertexBuffer, 0, vertices)

export const cellShaderModule = device.createShaderModule({
    label: 'Cell shader',
    code: `${vertShader}${fragShader}`
})



