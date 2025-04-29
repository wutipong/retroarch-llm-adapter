import express from "express";
import * as PImage from "pureimage"
import { bytesToBase64 } from 'byte-base64'
import { WritableStreamBuffer } from 'stream-buffers'

const app = express()
const port = 4404

app.use(express.json({
    inflate: true,
    type: () => true
}))

const font = PImage.registerFont("fonts/Mplus1Code-Regular.otf", "MPlus1Code")

app.post('/', async (req, res) => {
    const input = req.body

    const img1 = PImage.make(1000, 1000);

    // get canvas context
    const ctx = img1.getContext("2d");

    ctx.clearRect(0, 0, 1000, 1000)

    // fill with red
    ctx.font = "18pt MPlus1Code"
    ctx.fillStyle = "red";
    ctx.fillText("Hello World", 500, 500);

    ctx.save()

    const stream = new WritableStreamBuffer()

    await PImage.encodePNGToStream(img1, stream)

    stream.end()

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
    console.log(`Server started at port ${port}.`)
})