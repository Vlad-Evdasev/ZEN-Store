import { useEffect, useState } from "react";

/**
 * Maintenance-экран: показывается всем кроме allowlist, когда админ
 * включил maintenance mode. Тёмный фон с медленной градиент-анимацией,
 * пульсирующее ядро в центре, минималистичный текст «с душой».
 *
 * Дизайн принципы:
 * — без эмодзи и без «извините за неудобства»-болтовни
 * — короткий тёплый текст, как от человека, а не системного бота
 * — анимация «дышит» (16-20s loops), не отвлекает
 * — рендерим даже если settings/themes не загружены — экран
 *   автономный, в собственном тёмном стиле
 */
export function MaintenancePage() {
  // Маленький tick для динамического подкручивания счётчика «попыток».
  // Просто чтобы экран не казался статичным даже на маленьких устройствах.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1000), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="zen-maintenance">
      {/* Слой фона: радиальный градиент + дрейфующие orbs */}
      <div className="zen-maintenance__bg" aria-hidden>
        <div className="zen-maintenance__orb zen-maintenance__orb--a" />
        <div className="zen-maintenance__orb zen-maintenance__orb--b" />
        <div className="zen-maintenance__orb zen-maintenance__orb--c" />
        <div className="zen-maintenance__noise" />
      </div>

      {/* Контент */}
      <div className="zen-maintenance__inner">
        {/* Пульсирующее ядро */}
        <div className="zen-maintenance__core" aria-hidden>
          <div className="zen-maintenance__ring zen-maintenance__ring--1" />
          <div className="zen-maintenance__ring zen-maintenance__ring--2" />
          <div className="zen-maintenance__ring zen-maintenance__ring--3" />
          <div className="zen-maintenance__dot" />
        </div>

        <div className="zen-maintenance__brand">RAW</div>

        <h1 className="zen-maintenance__title">
          Подкручиваем гайки.
        </h1>
        <p className="zen-maintenance__sub">
          Что-то меняем под капотом — чтобы стало быстрее и приятнее.
          <br />
          Загляни через минутку, всё будет на месте.
        </p>

        <div className="zen-maintenance__meta">
          <span className="zen-maintenance__pulse" aria-hidden>
            <span />
          </span>
          <span className="zen-maintenance__metaText">
            online · обновляется{".".repeat((tick % 3) + 1)}
          </span>
        </div>
      </div>
    </div>
  );
}
