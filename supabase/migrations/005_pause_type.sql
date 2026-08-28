-- Add PAUSE question type (a break/separator slide with no answers)
ALTER TABLE public.questions
  DROP CONSTRAINT questions_type_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check
  CHECK (type IN ('MULTIPLE_CHOICE', 'OPEN', 'PROGRESSIVE_HINTS', 'FOLLOW_UP', 'PAUSE'));
