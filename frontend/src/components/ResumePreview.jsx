function SectionTitle({ children }) {
  return (
    <h2 className="mb-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
      {children}
    </h2>
  )
}

function DateRange({ start, end, current }) {
  const text = [
    start,
    current ? 'Present' : end,
  ]
    .filter(Boolean)
    .join(' — ')

  return text ? (
    <span className="text-[10px] text-slate-500">
      {text}
    </span>
  ) : null
}

function BulletList({ items = [] }) {
  if (!items.length) return null

  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10.5px] leading-4 text-slate-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          {item}
        </li>
      ))}
    </ul>
  )
}

export default function ResumePreview({
  resume,
  compact = false,
}) {
  if (!resume) {
    return null
  }

  const profile = resume.profile || {}
  const sectionOrder =
    resume.section_order || [
      'experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'languages',
    ]

  const template = resume.template || 'modern'
  const isCompact =
    compact || template === 'compact'

  const renderSection = (key) => {
    if (
      key === 'experience' &&
      (resume.experience || []).length
    ) {
      return (
        <section key={key}>
          <SectionTitle>Experience</SectionTitle>

          <div className="space-y-3">
            {resume.experience.map((item, index) => (
              <div key={item.id || index}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11.5px] font-bold text-slate-900">
                      {item.title}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-700">
                      {[item.company, item.location]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>

                  <DateRange
                    start={item.start_date}
                    end={item.end_date}
                    current={item.current}
                  />
                </div>

                <BulletList items={item.bullets} />
              </div>
            ))}
          </div>
        </section>
      )
    }

    if (
      key === 'education' &&
      (resume.education || []).length
    ) {
      return (
        <section key={key}>
          <SectionTitle>Education</SectionTitle>

          <div className="space-y-2.5">
            {resume.education.map((item, index) => (
              <div key={item.id || index}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11.5px] font-bold text-slate-900">
                      {[item.degree, item.field]
                        .filter(Boolean)
                        .join(' in ')}
                    </div>
                    <div className="text-[10.5px] text-slate-700">
                      {[item.school, item.location]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>

                  <DateRange
                    start={item.start_date}
                    end={item.end_date}
                  />
                </div>

                {item.details && (
                  <p className="mt-1 text-[10.5px] leading-4 text-slate-600">
                    {item.details}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )
    }

    if (
      key === 'skills' &&
      (resume.skills || []).length
    ) {
      return (
        <section key={key}>
          <SectionTitle>Skills</SectionTitle>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] leading-4 text-slate-700">
            {resume.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </section>
      )
    }

    if (
      key === 'projects' &&
      (resume.projects || []).length
    ) {
      return (
        <section key={key}>
          <SectionTitle>Projects</SectionTitle>

          <div className="space-y-3">
            {resume.projects.map((item, index) => (
              <div key={item.id || index}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11.5px] font-bold text-slate-900">
                      {item.name}
                    </div>
                    {item.role && (
                      <div className="text-[10.5px] text-slate-600">
                        {item.role}
                      </div>
                    )}
                  </div>

                  {item.url && (
                    <span className="max-w-[170px] truncate text-[9px] text-slate-500">
                      {item.url}
                    </span>
                  )}
                </div>

                {item.description && (
                  <p className="mt-1 text-[10.5px] leading-4 text-slate-700">
                    {item.description}
                  </p>
                )}

                <BulletList items={item.bullets} />

                {(item.technologies || []).length > 0 && (
                  <div className="mt-1 text-[9.5px] text-slate-500">
                    {item.technologies.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )
    }

    if (
      key === 'certifications' &&
      (resume.certifications || []).length
    ) {
      return (
        <section key={key}>
          <SectionTitle>Certifications</SectionTitle>

          <div className="space-y-1.5">
            {resume.certifications.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-start justify-between gap-3 text-[10.5px]"
              >
                <div>
                  <span className="font-semibold text-slate-800">
                    {item.name}
                  </span>
                  {item.issuer && (
                    <span className="text-slate-600">
                      {' '}
                      — {item.issuer}
                    </span>
                  )}
                </div>
                <span className="text-slate-500">
                  {item.date}
                </span>
              </div>
            ))}
          </div>
        </section>
      )
    }

    if (
      key === 'languages' &&
      (resume.languages || []).length
    ) {
      return (
        <section key={key}>
          <SectionTitle>Languages</SectionTitle>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-slate-700">
            {resume.languages.map((item, index) => (
              <span key={item.id || index}>
                <strong>{item.language}</strong>
                {item.level ? ` — ${item.level}` : ''}
              </span>
            ))}
          </div>
        </section>
      )
    }

    return null
  }

  return (
    <div
      id="resume-print-area"
      className={
        'mx-auto min-h-[1120px] w-full max-w-[794px] bg-white text-slate-900 shadow-sm ' +
        (isCompact
          ? 'px-8 py-8'
          : template === 'classic'
            ? 'px-12 py-10'
            : 'px-10 py-9')
      }
    >
      <header
        className={
          template === 'classic'
            ? 'border-b-2 border-slate-900 pb-4 text-center'
            : 'border-b border-slate-200 pb-4'
        }
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {profile.full_name || 'Your Name'}
        </h1>

        {profile.headline && (
          <div className="mt-1 text-sm font-medium text-slate-700">
            {profile.headline}
          </div>
        )}

        <div
          className={
            'mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 ' +
            (template === 'classic'
              ? 'justify-center'
              : '')
          }
        >
          {[
            profile.email,
            profile.phone,
            profile.location,
            profile.website,
            profile.linkedin,
            profile.github,
          ]
            .filter(Boolean)
            .map((item) => (
              <span key={item}>{item}</span>
            ))}
        </div>
      </header>

      <main className={isCompact ? 'mt-4 space-y-4' : 'mt-5 space-y-5'}>
        {resume.summary && (
          <section>
            <SectionTitle>Profile</SectionTitle>
            <p className="text-[10.5px] leading-4.5 text-slate-700">
              {resume.summary}
            </p>
          </section>
        )}

        {sectionOrder.map(renderSection)}
      </main>
    </div>
  )
}
