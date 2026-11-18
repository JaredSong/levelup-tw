import { MathText } from './MathText'

/**
 * An option that carries its own legend symbol (Question.optionImages). When the
 * official text leaves an empty 「」 where the symbol is printed (「」表示溫度計),
 * the symbol goes inside the brackets, as on the paper; otherwise it sits before
 * the text (表示鋼筋混凝土).
 */
export function OptionSymbolText({ symbol, text }: { symbol: string; text: string }) {
  const at = text.indexOf('「」')
  const image = <img className="option-symbol" src={symbol} alt="" />
  if (at < 0) {
    return (
      <span className="option-symbol-row">
        {image}
        <MathText text={text} />
      </span>
    )
  }
  return (
    <span className="option-symbol-inline">
      {at > 0 ? <MathText text={text.slice(0, at)} /> : null}「{image}」<MathText text={text.slice(at + 2)} />
    </span>
  )
}
