import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, type Lang } from './api';
import { storage } from './storage';

const en = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.delete': 'Delete',
  'common.retry': 'Try again',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.kcal': 'kcal',
  'common.kg': 'kg',
  'common.g': 'g',
  'common.t': 't',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',
  'common.optional': 'optional',
  'common.demo': 'Demo mode: the server has no GEMINI_API_KEY, so AI answers are samples.',

  'macro.protein': 'Protein',
  'macro.fat': 'Fat',
  'macro.carbs': 'Carbs',
  'macro.p': 'P',
  'macro.f': 'F',
  'macro.c': 'C',

  'tab.home': 'Home',
  'tab.workout': 'Workout',
  'tab.food': 'Food',
  'tab.coach': 'Coach',
  'tab.progress': 'Progress',

  'err.network': 'No connection. Try again.',
  'err.aiLimit': 'The free AI quota is used up for now. Try again in a minute.',
  'err.aiDown': "The AI didn't answer. Try again.",
  'err.generic': 'Something went wrong. Try again.',

  'home.hello': 'Your day',
  'home.eaten': 'eaten',
  'home.left': 'left',
  'home.over': 'over',
  'home.noTargets': 'Add height, weight and age to get your daily calorie target.',
  'home.fillProfile': 'Fill in profile',
  'home.workouts': 'Workouts',
  'home.thisWeek': 'this week',
  'home.streak': 'Streak',
  'home.days': 'days',
  'home.setsToday': 'Sets today',
  'home.statWorkouts': 'workouts this week',
  'home.statStreak': 'day streak',
  'home.statSets': 'sets today',
  'home.calories7': 'Calories · 7 days',
  'home.volume7': 'Training volume · 7 days',
  'home.target': 'target',
  'home.lifts': 'Strength',
  'home.liftsHint': 'Estimated 1-rep max by week',
  'home.noLifts': 'Log a few workouts and your strength trend shows up here.',
  'home.snap': 'Snap a meal',
  'home.snapSub': 'Calories from a photo',
  'home.ask': 'Ask the coach',
  'home.askSub': 'Plan, technique, food',

  'workout.title': 'Workout',
  'workout.last': 'last time',
  'workout.new': 'New exercise: start light, 10–12 reps',
  'workout.reps': 'reps',
  'workout.enterReps': 'Enter reps to save',
  'workout.saveSet': 'Save set',
  'workout.add': 'Add an exercise',
  'workout.addPlaceholder': 'e.g. Lunge',
  'workout.addBtn': 'Add',
  'workout.today': 'Today',
  'workout.noSets': 'No sets yet today.',
  'workout.undo': 'Undo',
  'workout.sets': 'sets',
  'workout.volume': 'volume',

  'food.title': 'Food',
  'food.snap': 'Snap your meal',
  'food.snapSub': 'AI estimates calories and macros from a photo',
  'food.camera': 'Camera',
  'food.gallery': 'Gallery',
  'food.manual': 'Add manually',
  'food.meal.BREAKFAST': 'Breakfast',
  'food.meal.LUNCH': 'Lunch',
  'food.meal.DINNER': 'Dinner',
  'food.meal.SNACK': 'Snack',
  'food.empty': 'Nothing yet',
  'food.analyzing': 'Looking at your plate…',
  'food.analyzingSub': 'Usually takes 5–15 seconds',
  'food.result': 'What I see',
  'food.notFood': "I don't see food in this photo. Try another one.",
  'food.confidence.low': 'Rough estimate',
  'food.confidence.medium': 'Fair estimate',
  'food.confidence.high': 'Good estimate',
  'food.adjust': 'Adjust grams if needed: calories update automatically.',
  'food.addTo': 'Add to',
  'food.addToDiary': 'Add to diary',
  'food.hint': 'Add a detail (optional): "fried in butter", "half portion"',
  'food.name': 'Name',
  'food.grams': 'Grams',
  'food.kcal': 'Calories',
  'food.permission': 'Allow camera access in Settings to snap meals.',
  'food.total': 'Total',

  'coach.title': 'AI Coach',
  'coach.sub': 'Knows your workouts and meals',
  'coach.placeholder': 'Ask about training or food…',
  'coach.empty': 'Ask me anything about your training, technique, recovery or food.',
  'coach.s1': 'Make me a plan for this week',
  'coach.s2': 'What should I eat after a workout?',
  'coach.s3': "Why isn't my bench press going up?",
  'coach.s4': 'How much protein do I need?',
  'coach.clear': 'Clear chat',
  'coach.thinking': 'Thinking…',
  'coach.disclaimer': 'AI can be wrong. Not medical advice.',

  'progress.title': 'Progress',
  'progress.empty': 'Log your first sets and your summary will appear here on Sunday.',
  'progress.best': 'Your best set this week',
  'progress.weeks': '{n} weeks logged. Here is what changed since your first week.',
  'progress.weekOf': 'Week of {d}',
  'progress.gain': '{n} kg in {w} weeks',
  'progress.footnote': 'Best set = the heaviest set once reps are taken into account (estimated 1-rep max).',
  'progress.UP': 'Up',
  'progress.FLAT': 'Holding steady',
  'progress.DOWN': 'Lower than week one',
  'progress.NEW': 'New, compare next week',
  'progress.baseline': 'First week logged. Next Sunday you will see how it changed.',

  'settings.title': 'Profile',
  'settings.language': 'Language',
  'settings.body': 'Body',
  'settings.sex': 'Sex',
  'settings.male': 'Male',
  'settings.female': 'Female',
  'settings.birthYear': 'Birth year',
  'settings.height': 'Height, cm',
  'settings.weight': 'Weight, kg',
  'settings.plan': 'Training plan',
  'settings.calories': 'Daily calories',
  'settings.auto': 'Auto: {n} kcal',
  'settings.custom': 'Own target, kcal',
  'settings.customHint': 'Leave empty to calculate from your body and goal',
  'settings.saved': 'Saved',
  'settings.signOut': 'Sign out',
  'settings.signOutHint': 'Your data stays on the server, but this device forgets the account.',

  'goal.GET_STRONGER': 'Get stronger',
  'goal.BUILD_MUSCLE': 'Build muscle',
  'goal.GENERAL_FITNESS': 'General fitness',
  'plan.goal': 'Main goal',
  'plan.days': 'Days per week',
  'plan.minutes': 'Minutes per session',

  'ob.tagline': 'Train without a coach. See what works.',
  'ob.lead': 'Log sets, track food with a photo, and get answers from an AI coach.',
  'ob.adult': 'Are you 18 or older?',
  'ob.healthTitle': 'A few health questions',
  'ob.healthLead': "Your answers only check it's safe to start. They aren't stored.",
  'ob.q.heartCondition': 'Has a doctor ever said you have a heart condition or high blood pressure?',
  'ob.q.chestPain': 'Do you feel pain in your chest at rest or during physical activity?',
  'ob.q.dizziness': 'Do you lose balance because of dizziness, or have you fainted in the last 12 months?',
  'ob.q.injury': 'Do you have a current injury, or a bone or joint problem that exercise could make worse?',
  'ob.q.pregnant': 'Are you pregnant, or have you given birth in the last 6 months?',
  'ob.weekTitle': 'Your week',
  'ob.bodyTitle': 'About you',
  'ob.bodyLead': 'Used to calculate your daily calories and protein. You can skip and add it later.',
  'ob.skip': 'Skip',
  'ob.consentTitle': 'Before you start',
  'ob.consentText':
    "• Delta is a training log for healthy adults. It is not medical advice.\n• Stop and see a doctor if you feel pain, dizziness or chest discomfort.\n• We don't ask for your name. Your logs are stored under a random ID.\n• Meal photos are sent to Google Gemini for analysis and are not stored by Delta.\n• You can ask us to delete your data at any time.",
  'ob.agree': "I've read this and agree.",
  'ob.start': 'Start',
  'ob.referredTitle': "Delta isn't the right fit right now",
  'ob.UNDER_18': 'Delta is for adults 18 and over. Please train with a qualified coach or a PE teacher who can supervise you.',
  'ob.HEALTH_SCREENING':
    "Based on your answers, Delta can't safely guide your training on its own. Please talk to a doctor or a qualified trainer before you start.",
  'ob.back': 'Back to start',
  'ob.step': 'Step {n} of {total}',

  'ex.Squat': 'Squat',
  'ex.Bench Press': 'Bench Press',
  'ex.Seated Row': 'Seated Row',
};

type Key = keyof typeof en;

const ru: Record<Key, string> = {
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.continue': 'Дальше',
  'common.delete': 'Удалить',
  'common.retry': 'Повторить',
  'common.yes': 'Да',
  'common.no': 'Нет',
  'common.kcal': 'ккал',
  'common.kg': 'кг',
  'common.g': 'г',
  'common.t': 'т',
  'common.today': 'Сегодня',
  'common.yesterday': 'Вчера',
  'common.optional': 'необязательно',
  'common.demo': 'Демо-режим: на сервере нет GEMINI_API_KEY, поэтому ответы ИИ — примеры.',

  'macro.protein': 'Белки',
  'macro.fat': 'Жиры',
  'macro.carbs': 'Углеводы',
  'macro.p': 'Б',
  'macro.f': 'Ж',
  'macro.c': 'У',

  'tab.home': 'Главная',
  'tab.workout': 'Тренировка',
  'tab.food': 'Питание',
  'tab.coach': 'Тренер',
  'tab.progress': 'Прогресс',

  'err.network': 'Нет соединения. Попробуй ещё раз.',
  'err.aiLimit': 'Бесплатный лимит ИИ пока исчерпан. Попробуй через минуту.',
  'err.aiDown': 'ИИ не ответил. Попробуй ещё раз.',
  'err.generic': 'Что-то пошло не так. Попробуй ещё раз.',

  'home.hello': 'Твой день',
  'home.eaten': 'съедено',
  'home.left': 'осталось',
  'home.over': 'сверх',
  'home.noTargets': 'Укажи рост, вес и возраст, чтобы получить дневную норму калорий.',
  'home.fillProfile': 'Заполнить профиль',
  'home.workouts': 'Тренировки',
  'home.thisWeek': 'на неделе',
  'home.streak': 'Серия',
  'home.days': 'дн.',
  'home.setsToday': 'Подходов',
  'home.statWorkouts': 'тренировок на неделе',
  'home.statStreak': 'дней подряд',
  'home.statSets': 'подходов сегодня',
  'home.calories7': 'Калории · 7 дней',
  'home.volume7': 'Объём тренировок · 7 дней',
  'home.target': 'норма',
  'home.lifts': 'Сила',
  'home.liftsHint': 'Расчётный максимум на 1 повтор по неделям',
  'home.noLifts': 'Запиши пару тренировок — здесь появится динамика силы.',
  'home.snap': 'Сфоткать еду',
  'home.snapSub': 'Калории по фото',
  'home.ask': 'Спросить тренера',
  'home.askSub': 'План, техника, питание',

  'workout.title': 'Тренировка',
  'workout.last': 'прошлый раз',
  'workout.new': 'Новое упражнение: начни с лёгкого веса, 10–12 повторов',
  'workout.reps': 'повт.',
  'workout.enterReps': 'Укажи повторы, чтобы сохранить',
  'workout.saveSet': 'Записать подход',
  'workout.add': 'Добавить упражнение',
  'workout.addPlaceholder': 'например, Выпады',
  'workout.addBtn': 'Добавить',
  'workout.today': 'Сегодня',
  'workout.noSets': 'Сегодня подходов ещё нет.',
  'workout.undo': 'Отменить',
  'workout.sets': 'подходов',
  'workout.volume': 'объём',

  'food.title': 'Питание',
  'food.snap': 'Сфоткай блюдо',
  'food.snapSub': 'ИИ посчитает калории и БЖУ по фото',
  'food.camera': 'Камера',
  'food.gallery': 'Галерея',
  'food.manual': 'Вручную',
  'food.meal.BREAKFAST': 'Завтрак',
  'food.meal.LUNCH': 'Обед',
  'food.meal.DINNER': 'Ужин',
  'food.meal.SNACK': 'Перекус',
  'food.empty': 'Пока пусто',
  'food.analyzing': 'Рассматриваю тарелку…',
  'food.analyzingSub': 'Обычно 5–15 секунд',
  'food.result': 'Что я вижу',
  'food.notFood': 'Не вижу на фото еды. Попробуй другое фото.',
  'food.confidence.low': 'Грубая оценка',
  'food.confidence.medium': 'Примерная оценка',
  'food.confidence.high': 'Точная оценка',
  'food.adjust': 'Поправь граммы, если нужно — калории пересчитаются.',
  'food.addTo': 'Куда',
  'food.addToDiary': 'Добавить в дневник',
  'food.hint': 'Уточнение (необязательно): «жарено на масле», «полпорции»',
  'food.name': 'Название',
  'food.grams': 'Граммы',
  'food.kcal': 'Калории',
  'food.permission': 'Разреши доступ к камере в настройках, чтобы фотографировать еду.',
  'food.total': 'Итого',

  'coach.title': 'ИИ-тренер',
  'coach.sub': 'Видит твои тренировки и питание',
  'coach.placeholder': 'Спроси про тренировки или еду…',
  'coach.empty': 'Спрашивай что угодно про тренировки, технику, восстановление и питание.',
  'coach.s1': 'Составь план на эту неделю',
  'coach.s2': 'Что съесть после тренировки?',
  'coach.s3': 'Почему не растёт жим лёжа?',
  'coach.s4': 'Сколько мне нужно белка?',
  'coach.clear': 'Очистить чат',
  'coach.thinking': 'Думаю…',
  'coach.disclaimer': 'ИИ может ошибаться. Это не медицинский совет.',

  'progress.title': 'Прогресс',
  'progress.empty': 'Запиши первые подходы — в воскресенье здесь появится сводка.',
  'progress.best': 'Лучший подход на этой неделе',
  'progress.weeks': 'Недель в дневнике: {n}. Вот что изменилось с первой недели.',
  'progress.weekOf': 'Неделя {d}',
  'progress.gain': '{n} кг за {w} нед.',
  'progress.footnote': 'Лучший подход — самый тяжёлый с учётом повторов (расчётный максимум на 1 повтор).',
  'progress.UP': 'Растёт',
  'progress.FLAT': 'Держится',
  'progress.DOWN': 'Ниже первой недели',
  'progress.NEW': 'Новое, сравним через неделю',
  'progress.baseline': 'Первая неделя записана. В следующее воскресенье увидишь, что изменилось.',

  'settings.title': 'Профиль',
  'settings.language': 'Язык',
  'settings.body': 'Тело',
  'settings.sex': 'Пол',
  'settings.male': 'Мужской',
  'settings.female': 'Женский',
  'settings.birthYear': 'Год рождения',
  'settings.height': 'Рост, см',
  'settings.weight': 'Вес, кг',
  'settings.plan': 'План тренировок',
  'settings.calories': 'Калории в день',
  'settings.auto': 'Авто: {n} ккал',
  'settings.custom': 'Своя норма, ккал',
  'settings.customHint': 'Оставь пустым — посчитаем по телу и цели',
  'settings.saved': 'Сохранено',
  'settings.signOut': 'Выйти',
  'settings.signOutHint': 'Данные останутся на сервере, но это устройство забудет аккаунт.',

  'goal.GET_STRONGER': 'Стать сильнее',
  'goal.BUILD_MUSCLE': 'Набрать мышцы',
  'goal.GENERAL_FITNESS': 'Общая форма',
  'plan.goal': 'Главная цель',
  'plan.days': 'Дней в неделю',
  'plan.minutes': 'Минут на тренировку',

  'ob.tagline': 'Тренируйся без тренера. Видь, что работает.',
  'ob.lead': 'Записывай подходы, считай еду по фото и спрашивай ИИ-тренера.',
  'ob.adult': 'Тебе есть 18?',
  'ob.healthTitle': 'Пара вопросов о здоровье',
  'ob.healthLead': 'Ответы нужны только чтобы проверить, что начинать безопасно. Мы их не храним.',
  'ob.q.heartCondition': 'Врач когда-нибудь говорил, что у тебя проблемы с сердцем или высокое давление?',
  'ob.q.chestPain': 'Бывает ли боль в груди в покое или при нагрузке?',
  'ob.q.dizziness': 'Теряешь ли равновесие из-за головокружения, были ли обмороки за последние 12 месяцев?',
  'ob.q.injury': 'Есть ли сейчас травма или проблемы с костями и суставами, которые нагрузка может ухудшить?',
  'ob.q.pregnant': 'Ты беременна или рожала в последние 6 месяцев?',
  'ob.weekTitle': 'Твоя неделя',
  'ob.bodyTitle': 'О тебе',
  'ob.bodyLead': 'Нужно, чтобы посчитать норму калорий и белка. Можно пропустить и заполнить позже.',
  'ob.skip': 'Пропустить',
  'ob.consentTitle': 'Перед стартом',
  'ob.consentText':
    '• Delta — дневник тренировок для здоровых взрослых. Это не медицинский совет.\n• Остановись и обратись к врачу, если чувствуешь боль, головокружение или дискомфорт в груди.\n• Мы не спрашиваем имя. Записи хранятся под случайным ID.\n• Фото еды отправляются в Google Gemini для анализа, Delta их не хранит.\n• Ты можешь попросить удалить свои данные в любой момент.',
  'ob.agree': 'Я прочитал(а) и согласен(на).',
  'ob.start': 'Начать',
  'ob.referredTitle': 'Delta сейчас не подходит',
  'ob.UNDER_18':
    'Delta — для взрослых от 18 лет. Тренируйся с квалифицированным тренером или учителем физкультуры, который сможет за тобой присмотреть.',
  'ob.HEALTH_SCREENING':
    'По твоим ответам Delta не может безопасно вести твои тренировки самостоятельно. Перед началом поговори с врачом или квалифицированным тренером.',
  'ob.back': 'В начало',
  'ob.step': 'Шаг {n} из {total}',

  'ex.Squat': 'Присед',
  'ex.Bench Press': 'Жим лёжа',
  'ex.Seated Row': 'Тяга сидя',
};

const dicts: Record<Lang, Record<Key, string>> = { en, ru };
const LANG_KEY = 'delta.lang';

export type T = (key: Key, params?: Record<string, string | number>) => string;

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
  /** Display name for an exercise: translates the default ones, leaves user-typed names as they are. */
  ex: (name: string) => string;
  locale: string;
};

const deviceLang = (): Lang => (getLocales()[0]?.languageCode === 'ru' ? 'ru' : 'en');

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang);

  useEffect(() => {
    storage.get(LANG_KEY).then((v) => {
      if (v === 'ru' || v === 'en') setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.set(LANG_KEY, l);
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = dicts[lang];
    const t: T = (key, params) => {
      let s = dict[key] ?? en[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
      return s;
    };
    const ex = (name: string) => {
      const k = `ex.${name}` as Key;
      return k in dict ? dict[k] : name;
    };
    return { lang, setLang, t, ex, locale: lang === 'ru' ? 'ru-RU' : 'en-GB' };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}

/** Turns an API error into a message in the current language. */
export function errorText(e: unknown, t: T): string {
  if (e instanceof ApiError) {
    if (e.code === 'NETWORK') return t('err.network');
    if (e.code === 'AI_RATE_LIMIT') return t('err.aiLimit');
    if (e.code === 'AI_UNAVAILABLE') return t('err.aiDown');
    return e.message;
  }
  return t('err.generic');
}
