
import { device, vertexBuffer, vertices, canvasFormat, context, cellShaderModule } from "/webgpu.js"


const GRID_SIZE = 32

const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE])

const uniformBuffer = device.createBuffer({
    label: 'Grid Uniforms',
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})


device.queue.writeBuffer(uniformBuffer, 0, uniformArray);



const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE)

const cellStateStorage = [
    device.createBuffer({
        label: 'Cell State A',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
        label: 'Cell State B',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,

    })
]

cellStateArray.forEach((v, i) => {
    if (i % 3 === 0) {
        cellStateArray[i] = 1;
    }
})
device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray)

cellStateArray.forEach((v, i) => {
    cellStateArray[i] = i % 2
})
device.queue.writeBuffer(cellStateStorage[1], 0, cellStateArray)

const bindGroupLayout = device.createBindGroupLayout({
    label: 'Cell Bind Group Layout',
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: {}
        },
        {
            binding: 1,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: { type: 'read-only-storage' }
        },
        {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' }
        },
    ]
})

const bindGroups = [
    device.createBindGroup({
        label: 'Cell render bind group A',
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: { buffer: uniformBuffer }
            },
            {
                binding: 1,
                resource: { buffer: cellStateStorage[0] }
            },
            {
                binding: 2,
                resource: { buffer: cellStateStorage[1] }
            }
        ]
    }),
    device.createBindGroup({
        label: 'Cell render bind group B',
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: { buffer: uniformBuffer }
            },
            {
                binding: 1,
                resource: { buffer: cellStateStorage[1] }
            },
            {
                binding: 2,
                resource: { buffer: cellStateStorage[0] }
            }
        ]
    }),
]
const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [{
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0,
    }]
}



const pipelineLayout = device.createPipelineLayout({
    label: 'Cell Pipeline Layout',
    bindGroupLayouts: [bindGroupLayout],
})
const cellPipeline = device.createRenderPipeline({
    label: 'Cell pipeline',
    layout: pipelineLayout,
    vertex: {
        module: cellShaderModule,
        entryPoint: 'vertexMain',
        buffers: [vertexBufferLayout]
    },
    fragment: {
        module: cellShaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
            format: canvasFormat
        }]
    }
})
// console.log(cellStateArray);
const simulationShaderModule = device.createShaderModule({
    label: 'Game of Life simulation shader',
    code: `
    @group(0) @binding(0) var<uniform> grid: vec2f;

    @group(0) @binding(1) var<storage> cellStateIn: array<u32>;
    @group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>;
    
    fn cellIndex(cell: vec2u) -> u32 {
        return cell.y * u32(grid.x) + cell.x;
    }

    @compute
    @workgroup_size(8, 8)
    fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
    
        if(cellStateIn[cellIndex(cell.xy)] == 1) {
            cellStateOut[cellIndex(cell.xy)] = 0;
        }else {
            cellStateOut[cellIndex(cell.xy)] = 1;
        }
    
    }
    `
})
const simulationPipeline = device.createComputePipeline({
    label: 'Simulation pipeline',
    layout: pipelineLayout,
    compute: {
        module: simulationShaderModule,
        entryPoint: "computeMain",
    }
})

const UPDATE_INTERVAL = 200
let step = 0

function updateGrid() {
    const encoder = device.createCommandEncoder()

    const computePass = encoder.beginComputePass()

    computePass.setPipeline(simulationPipeline)
    computePass.setBindGroup(0, bindGroups[step % 2])

    const workgroupCount = Math.ceil(GRID_SIZE / 8)

    computePass.dispatchWorkgroups(workgroupCount, workgroupCount)

    computePass.end()
    step++

    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: [0, 0, 0.4, 1.0],
            storeOp: "store",
        }]
    })

    pass.setPipeline(cellPipeline)
    pass.setVertexBuffer(0, vertexBuffer)
    pass.setBindGroup(0, bindGroups[step % 2])
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE)

    pass.end();
    const commandBuffer = encoder.finish()

    device.queue.submit([commandBuffer])
}


setInterval(updateGrid, UPDATE_INTERVAL)