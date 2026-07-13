$ErrorActionPreference = "Stop"

$files = @()
$files += Get-ChildItem "pages" -Filter *.html
$files += Get-ChildItem "frontend/components" -Filter *.html
$files += Get-ChildItem "frontend/sections" -Filter *.html

$map = [ordered]@{
  "../ASSETS/Logo/AGU Clean Services logo design v1.1.png" = "../frontend/assets/brand/logo.png"
  "../ASSETS/Icon System/Brand Icons/svg-regenerated/agu-favicon-icon.svg" = "../frontend/assets/brand/favicon.svg"
  "../ASSETS/Icon System/Brand Icons/svg-regenerated/agu-app-icon.svg" = "../frontend/assets/brand/app-icon.svg"
  "../ASSETS/Icon System/Brand Icons/svg-regenerated/gold-divider.svg" = "../frontend/assets/brand/divider.svg"
  "../ASSETS/Icon System/Brand Icons/svg-regenerated/master-logo.svg" = "../frontend/assets/brand/master-logo.svg"
  "../ASSETS/Icon System/Brand Icons/svg-regenerated/agu-logo-mark.svg" = "../frontend/assets/brand/logo-mark.svg"
  "../ASSETS/Icon System/Brand Icons/svg-regenerated/sparkle-large.svg" = "../frontend/assets/brand/sparkle-large.svg"
  "../ASSETS/Icon System/Brand Icons/svg-regenerated/sparkle-medium.svg" = "../frontend/assets/brand/sparkle-medium.svg"
  "../ASSETS/Icon System/Service Icons/Home Cleaning.png" = "../frontend/assets/service/home-cleaning.png"
  "../ASSETS/Icon System/Service Icons/Deep Cleaning.png" = "../frontend/assets/service/deep-cleaning.png"
  "../ASSETS/Icon System/Service Icons/End of Tenancy.png" = "../frontend/assets/service/end-of-tenancy.png"
  "../ASSETS/Icon System/Service Icons/Commercial Cleaning.png" = "../frontend/assets/service/commercial-cleaning.png"
  "../ASSETS/Icon System/Service Icons/Airbnb Cleaning.png" = "../frontend/assets/service/airbnb-cleaning.png"
  "../ASSETS/Icon System/Service Icons/Pubs_Clubs.png" = "../frontend/assets/service/pubs-clubs.png"
  "../ASSETS/Icon System/Service Icons/Kitchen Cleaning.png" = "../frontend/assets/service/kitchen-cleaning.png"
  "../ASSETS/Icon System/Service Icons/Floor Cleaning.png" = "../frontend/assets/service/floor-cleaning.png"
  "../ASSETS/Icon System/Service Icons/Office Cleaning.png" = "../frontend/assets/service/office-cleaning.png"
  "../ASSETS/Icon System/Service Icons/Move In Cleaning.png" = "../frontend/assets/service/move-in-cleaning.png"
  "../ASSETS/Icon System/Service Icons/Move Out Cleaning.png" = "../frontend/assets/service/move-out-cleaning.png"
  "../ASSETS/Icon System/Trust Icons/Reliable ✔ Check Shield.png" = "../frontend/assets/trust/reliable.png"
  "../ASSETS/Icon System/Trust Icons/Flexible Hours 🕒 Clock.png" = "../frontend/assets/trust/flexible-hours.png"
  "../ASSETS/Icon System/Trust Icons/Fully Insured 🛡 Shield Check.png" = "../frontend/assets/trust/fully-insured.png"
  "../ASSETS/Icon System/Trust Icons/Trusted 🤝 Handshake.png" = "../frontend/assets/trust/trusted.png"
  "../ASSETS/Icon System/Trust Icons/Local Business 📍 Location Pin.png" = "../frontend/assets/trust/local-business.png"
  "../ASSETS/Icon System/Trust Icons/Family Business ❤️ House Heart.png" = "../frontend/assets/trust/family-business.png"
  "../ASSETS/Icon System/Trust Icons/Professional 👔 Professional Badge.png" = "../frontend/assets/trust/professional.png"
  "../ASSETS/Icon System/Trust Icons/Quality Guaranteed ⭐ Badge.png" = "../frontend/assets/trust/quality-guaranteed.png"
  "../ASSETS/Icon System/Bookin Icons/Free Quote.png" = "../frontend/assets/booking/free-quote.png"
  "../ASSETS/Icon System/Bookin Icons/Calendar.png" = "../frontend/assets/booking/calendar.png"
  "../ASSETS/Icon System/Bookin Icons/Schedule.png" = "../frontend/assets/booking/schedule.png"
  "../ASSETS/Icon System/Bookin Icons/Booking Form.png" = "../frontend/assets/booking/booking-form.png"
  "../ASSETS/Icon System/Bookin Icons/Checklist.png" = "../frontend/assets/booking/checklist.png"
  "../ASSETS/Icon System/Bookin Icons/Confirmation.png" = "../frontend/assets/booking/confirmation.png"
  "../ASSETS/Icon System/Contact Icons/WhatsApp.png" = "../frontend/assets/contact/whatsapp.png"
  "../ASSETS/Icon System/Contact Icons/Email.png" = "../frontend/assets/contact/email.png"
  "../ASSETS/Icon System/Contact Icons/Mobile.png" = "../frontend/assets/contact/mobile.png"
  "../ASSETS/Icon System/Contact Icons/lOCALISATION.png" = "../frontend/assets/contact/location.png"
  "../ASSETS/Icon System/Contact Icons/Website.png" = "../frontend/assets/contact/website.png"
  "../ASSETS/Icon System/Contact Icons/Phone.png" = "../frontend/assets/contact/phone.png"
  "../ASSETS/Icon System/Cleaning Equipment/Vacuum Cleaner.png" = "../frontend/assets/equipment/vacuum-cleaner.png"
  "../ASSETS/Icon System/Cleaning Equipment/Cleaning Products.png" = "../frontend/assets/equipment/cleaning-products.png"
  "../ASSETS/Icon System/Cleaning Equipment/Microfiber Cloth.png" = "../frontend/assets/equipment/microfiber-cloth.png"
  "../ASSETS/Icon System/Cleaning Equipment/Cleaning Basket.png" = "../frontend/assets/equipment/cleaning-basket.png"
}

foreach ($file in $files) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  foreach ($entry in $map.GetEnumerator()) {
    $content = $content.Replace($entry.Key, $entry.Value)
  }
  Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8
}
