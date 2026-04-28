//stage 3: Generates pagination links for API responses
const generatePaginationLinks = (req, page, limit, totalPages) => {
  const buildUrl = (targetPage) => {
    // Copy existing query params so we don't lose user filters
    const queryObj = { ...req.query, page: targetPage, limit };
    const queryString = new URLSearchParams(queryObj).toString();
    
    // req.path will be '/' for the slicer, and '/search' for the NLP route
    const path = req.path === '/' ? '' : req.path;
    return `/api/profiles${path}?${queryString}`;
  };

  return {
    self: buildUrl(page),
    next: page < totalPages ? buildUrl(page + 1) : null,
    prev: page > 1 ? buildUrl(page - 1) : null,
  };
};

// Stage 2: Translates a sentence word into an age group string
const extractAgeGroup = (sentence) => {
  if (/\b(child|children)\b/.test(sentence)) return "child";
  if (/\b(teenager|teenagers)\b/.test(sentence)) return "teenager";
  if (/\b(adult|adults)\b/.test(sentence)) return "adult";
  if (/\b(senior|seniors)\b/.test(sentence)) return "senior";

  return null;
};

// Stage 1: Translates an exact number into an age group string
const getAgeGroup = (age) => {
  if (age >= 0 && age <= 12) return "child";
  if (age >= 13 && age <= 19) return "teenager";
  if (age >= 20 && age <= 59) return "adult";
  if (age >= 60) return "senior";
  return null;
};

// Stage 3: Builds MongoDB query filters and sort options based on user input
const buildQueryOptions = (query) => {
  const {
    gender,
    age_group,
    country_id,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by,
    order,
  } = query;

  const filter = {};
  if (gender) filter.gender = gender.toLowerCase();
  if (age_group) filter.age_group = age_group.toLowerCase();
  if (country_id) filter.country_id = country_id.toUpperCase();

  if (min_age || max_age) {
    filter.age = {};
    if (min_age) filter.age.$gte = Number(min_age);
    if (max_age) filter.age.$lte = Number(max_age);
  }

  if (min_gender_probability)
    filter.gender_probability = { $gte: Number(min_gender_probability) };
  if (min_country_probability)
    filter.country_probability = { $gte: Number(min_country_probability) };

  const sortOptions = {};
  if (sort_by) {
    sortOptions[sort_by] = order === "desc" ? -1 : 1;
  }

  return { filter, sortOptions };
};

module.exports = {
  extractAgeGroup,
  getAgeGroup,
  generatePaginationLinks,
  buildQueryOptions,
};
