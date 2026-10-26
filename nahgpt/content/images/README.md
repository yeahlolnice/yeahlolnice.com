# images/

Drop your GIFs and images in here, then add entries to the response arrays in `content/chat.js`.

## How to add an image response

Open `content/chat.js` and add an entry like this to either `nahResponses` or `interruptResponses`:

```js
{ type: "image", value: "content/images/yourfile.gif", alt: "description" }
```

### Example — mix of text and image responses:

```js
const nahResponses = [
  { type: "text",  value: "nah." },
  { type: "image", value: "content/images/nah.gif",     alt: "nah" },
  { type: "image", value: "content/images/eyeroll.gif", alt: "eye roll" },
  { type: "text",  value: "not today" },
  ...
];
```

Supported formats: `.gif`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`
