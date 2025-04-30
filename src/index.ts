import express from "express";
import * as PImage from "pureimage"
import { bytesToBase64 } from 'byte-base64'
import { WritableStreamBuffer } from 'stream-buffers'
import { LLM, LMStudioClient } from "@lmstudio/sdk";
import pino from "pino";

const app = express()
const port = 4404

app.use(express.json({
    type: () => true
}))

const font = PImage.registerFont("fonts/Mplus1Code-Bold.otf", "MPlus1Code")

const lmstudio = new LMStudioClient();
var model: LLM

const MODEL_NAME = "gemma-3-4b-it-qat";
const OUTPUT_WIDTH = 1920
const OUTPUT_HEIGHT = 1080

const logger = pino({
    level: process.env.PINO_LOG_LEVEL || 'debug',
    timestamp: pino.stdTimeFunctions.isoTime,
  });

app.post('/', async (req, res) => {
    const input = req.body

    logger.debug(req, "request")

    const llmFile = await lmstudio.files.prepareImageBase64("screenshot.png", input.image)

    const result = await model.respond({
        content: `extract the texts in the image and translate them. the output should be in JSON format like:
        json\`\`\`
        [
            {
                location: "message window",
                original: "こんにちは。",
                translation: "Hello.",
            },
        ]
        \`\`\`
        `,
        images: [llmFile]
    });

    logger.debug(result.content, "result from LM Studio")

    let resultJSON = result.content.trim()
    if (resultJSON.startsWith("```json")) {
        resultJSON = resultJSON.substring(7)
    }

    if (resultJSON.endsWith("```")) {
        resultJSON = resultJSON.substring(0, resultJSON.length - 3)
    }

    logger.debug(resultJSON, "resultJSON")

    const translations = JSON.parse(resultJSON)
    const outImg = PImage.make(OUTPUT_WIDTH, OUTPUT_HEIGHT);

    // get canvas context
    const ctx = outImg.getContext("2d");

    ctx.clearRect(0, 0, outImg.width, outImg.height)

    ctx.fillStyle = "#00000080"
    ctx.fillRect(0, 0, outImg.width, outImg.height)

    let yPos = 100;
    const lineHeight = 48;

    for (const t of translations) {
        // fill with red
        ctx.font = "28pt MPlus1Code"
        ctx.fillStyle = "green";

        ctx.fillText(t.location, 10, yPos);

        yPos += lineHeight;
        ctx.fillStyle = "cyan";

        const lines = t.translation.split('\n')

        for (const l of lines) {
            const splitted = l.match(/.{1,80}/g)
            for (const s of splitted) {
                ctx.fillText(s.trim(), 60, yPos);
                yPos += lineHeight;
            }
        }
    }

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

    logger.info(`Server started at port ${port}.`)
})