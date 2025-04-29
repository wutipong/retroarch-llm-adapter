import express from "express";
import * as PImage from "pureimage"
import { base64ToBytes, bytesToBase64 } from 'byte-base64'
import { WritableStreamBuffer } from 'stream-buffers'
import { PNG } from "pngjs";
import { LLM, LMStudioClient } from "@lmstudio/sdk";

const app = express()
const port = 4404

app.use(express.json({
    type: () => true
}))

const font = PImage.registerFont("fonts/Mplus1Code-Regular.otf", "MPlus1Code")

const lmstudio = new LMStudioClient();
var model: LLM

const MODEL_NAME = "gemma-3-4b-it-qat";

app.post('/', async (req, res) => {
    const input = req.body
    const imgSrc = base64ToBytes(input.image)
    const inImg = PNG.sync.read(Buffer.from(imgSrc))

    const llmFile = await lmstudio.files.prepareImageBase64("screenshot.png", input.image)

    const result = await model.respond({
        content: `extract the texts in the image and translate them. the output should be in JSON format like:
        json\`\`\`
        [
            {
                location: "message window",
                original: "こんにちは。"
                translation: "Hello."
            },
        ]
        \`\`\`
        `,
        images: [llmFile]
    });

    let resultJSON = result.content.trim()
    if (resultJSON.startsWith("```json")) {
        resultJSON = resultJSON.substring(7)
    }

    if (resultJSON.endsWith("```")) {
        resultJSON = resultJSON.substring(0, resultJSON.length - 3)
    }

    const translations = JSON.parse(resultJSON)

    const outImg = PImage.make(inImg.width, inImg.height);

    // get canvas context
    const ctx = outImg.getContext("2d");

    ctx.clearRect(0, 0, inImg.width, inImg.height)

    // fill with red
    ctx.font = "18pt MPlus1Code"
    ctx.fillStyle = "red";
    ctx.fillText(translations[0].translation, 0, inImg.height / 2);

    const stream = new WritableStreamBuffer()

    await PImage.encodePNGToStream(outImg, stream)

    const content = stream.getContents()
    if (!content) {
        res.json({
            error: "failed to create image."
        })

        return
    }
    res.json({
        image: bytesToBase64(content)
    })
})

app.listen(port, async () => {
    await font.load()
    model = await lmstudio.llm.model(MODEL_NAME);

    console.log(`Server started at port ${port}.`)
})