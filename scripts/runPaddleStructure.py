import argparse
import os


def main():
    parser = argparse.ArgumentParser(description="Run PaddleOCR PP-StructureV3 for flagged official-PDF pages.")
    parser.add_argument("jobs", nargs="+", help="Alternating image and output-directory pairs.")
    args = parser.parse_args()
    if len(args.jobs) % 2:
        parser.error("jobs must be alternating image and output-directory pairs")

    try:
        from paddleocr import PPStructureV3
    except ImportError as error:
        raise SystemExit(
            "PaddleOCR is not installed. Run `npm run setup:paddle` first, "
            "or set PADDLE_PYTHON to an existing PaddleOCR environment."
        ) from error

    pipeline = PPStructureV3(
        engine=os.environ.get("PADDLE_ENGINE", "onnxruntime"),
        use_formula_recognition=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    for image, output in zip(args.jobs[::2], args.jobs[1::2]):
        os.makedirs(output, exist_ok=True)
        for result in pipeline.predict(image):
            result.save_to_json(save_path=output)
            result.save_to_markdown(save_path=output)


if __name__ == "__main__":
    main()
